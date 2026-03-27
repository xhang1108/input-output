
import { Lexer, Token, TokenType } from './Lexer';
import { IOGL_MANIFEST } from './manifest';
import { InjectableGraph } from '../engine/types';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';
import { generateNodeId, generateEdgeId } from '../utils/idGenerator';
import { DataType, NodePayload } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';
import { ColorUtils } from '../utils/ColorUtils';

interface RawNode {
  id: string; // The Type (e.g. IN-01)
  label?: string; // The user-defined Label (e.g. [my_num])
  props: Record<string, any>;
  x?: number;
  y?: number;
}

interface RawEdge {
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle: string;
  line: number;
}

export class Parser {
  private lexer: Lexer;
  private current: Token;
  private nodes: Map<string, RawNode> = new Map();
  private edges: RawEdge[] = [];
  private labelToId: Map<string, string> = new Map(); // Label/Alias -> InternalTempID
  private diagnostics: string[] = [];
  private nodeCounter = 0;
  private hasExplicitPositions = false;

  constructor(input: string) {
    this.lexer = new Lexer(input);
    this.current = this.lexer.nextToken();
  }

  private advance() {
    this.current = this.lexer.nextToken();
  }

  private expect(type: TokenType): Token {
    if (this.current.type !== type) {
      this.diagnostics.push(`Error at L${this.current.line}:C${this.current.col}: Expected ${type}, got ${this.current.type} ('${this.current.value}')`);
    }
    const tok = this.current;
    this.advance();
    return tok;
  }

  private skipLineEnd() {
    while (this.current.type === 'NEWLINE') this.advance();
  }

  public parse(): { graph: InjectableGraph; diagnostics: string[] } {
    while ((this.current.type as TokenType) !== 'EOF') {
      this.skipLineEnd();
      if ((this.current.type as TokenType) === 'EOF') break;

      this.parseDeclaration();
    }

    return { graph: this.buildGraph(), diagnostics: this.diagnostics };
  }

  private parseDeclaration() {
    // Look ahead to see if there's an ARROW in this line
    let isEdge = false;
    let i = 0;
    while (true) {
        const next = this.lexer.peek(i);
        if (next.type === 'NEWLINE' || next.type === 'EOF') break;
        if (next.type === 'ARROW') {
            isEdge = true;
            break;
        }
        i++;
    }

    if (isEdge) {
      this.parseEdge();
    } else {
      this.parseNode();
    }
    
    // Ensure we reach newline
    while (this.current.type !== 'NEWLINE' && this.current.type !== 'EOF') {
        this.advance();
    }
  }

  private parseNode() {
    let label: string | undefined;
    if (this.current.type === 'LBRACKET') {
      this.advance();
      label = this.expect('ID').value;
      this.expect('RBRACKET');
    }

    const typeId = this.expect('ID').value;
    const props: Record<string, any> = {};

    if (this.current.type === 'LBRACE') {
      this.advance();
      while ((this.current.type as TokenType) !== 'RBRACE' && (this.current.type as TokenType) !== 'EOF') {
        const key = this.expect('ID').value;
        this.expect('COLON');
        props[key] = this.parseValue();
        if ((this.current.type as TokenType) === 'COMMA') this.advance();
      }
      this.expect('RBRACE');
    }

    // Support positional data (RAW_VALUE or LBRACKET)
    let positionalIdx = 0;
    const manifest = IOGL_MANIFEST[typeId];
    
    while (
      (this.current.type as TokenType) !== 'AT' && 
      (this.current.type as TokenType) !== 'NEWLINE' && 
      (this.current.type as TokenType) !== 'EOF' && 
      (this.current.type as TokenType) !== 'ARROW'
    ) {
      const t = this.current.type as TokenType;
      if (t === 'RAW_VALUE' || t === 'LBRACKET' || t === 'ID' || t === 'EQUALS' || t === 'NUMBER') {
        // Handle explicit key=value in positional context if needed, but usually it's just values
        const val = this.parseValue();
        
        // Smart Mode Detection:
        // If it's the first positional item, and it's an ID, and the manifest has a modeProperty,
        // and it's NOT already defined in the {} block... treat it as mode.
        if (positionalIdx === 0 && t === 'ID' && manifest?.modeProperty && props.mode === undefined) {
             props.mode = val;
        } else {
             if (!props.data) props.data = [];
             props.data.push(val);
        }
        
        positionalIdx++;
        if ((this.current.type as TokenType) === 'COMMA') this.advance();
      } else {
        break;
      }
    }

    let x, y;
    if (this.current.type === 'AT') {
      this.advance();
      this.hasExplicitPositions = true;
      // Use a helper to consume numeric IDs (including negative signs)
      const parseNum = () => {
          let val = this.expect('NUMBER').value;
          const num = parseFloat(val);
          return isNaN(num) ? undefined : num;
      };
      
      x = parseNum();
      if ((this.current.type as TokenType) === 'COMMA') {
        this.advance();
        y = parseNum();
      }
    }

    const internalTempId = `t_${this.nodeCounter++}`;
    this.nodes.set(internalTempId, { id: typeId, label, props, x, y });
    
    // Map both label and typeId (if unique) to the internal ID
    if (label) this.labelToId.set(label, internalTempId);
    this.labelToId.set(internalTempId, internalTempId); // Always map itself
    
    // Fallback: also map by typeId if it's the first one seen
    if (!this.labelToId.has(typeId)) {
        this.labelToId.set(typeId, internalTempId);
    }
  }

  private parseValue(): any {
    if (this.current.type === 'RAW_VALUE' || this.current.type === 'NUMBER') {
        const val = this.current.value;
        this.advance();
        return this.parseLiteral(val);
    }
    
    if (this.current.type === 'LBRACKET') {
        let depth = 0;
        let valStr = '';
        while ((this.current.type as TokenType) !== 'EOF') {
            const char = this.current.value;
            const type = this.current.type;

            if ((type as string) === 'LBRACKET') depth++;
            if ((type as string) === 'RBRACKET') depth--;
            
            if ((type as string) === 'RAW_VALUE' || (type as string) === 'NUMBER') {
                valStr += char;
            } else if ((type as string) === 'ID') {
                valStr += `"${char}"`; // Treat IDs inside brackets as strings
            } else {
                valStr += char;
            }

            this.advance();
            if (depth === 0) break;
        }

        try {
            // Robust cleaning for numeric and string values in bracketed blocks
            const cleaned = valStr.replace(/([a-zA-Z0-9_\-\.]+)/g, (m) => {
                if (m === 'true' || m === 'false' || m === 'null' || !isNaN(Number(m))) return m;
                return `"${m}"`;
            });
            return JSON.parse(cleaned);
        } catch (e) {
            return valStr;
        }
    }

    const val = this.current.value;
    this.advance();
    return this.parseLiteral(val);
  }

  private parseEdge() {
    const sourceRef = this.parseRef();
    this.expect('ARROW');
    const targetRef = this.parseRef();

    this.edges.push({
      source: sourceRef.id,
      sourceHandle: sourceRef.handle,
      target: targetRef.id,
      targetHandle: targetRef.handle || 'in_a',
      line: this.current.line
    });
  }

  private parseRef(): { id: string; handle?: string } {
    let idCandidate = this.expect('ID').value;
    let id = idCandidate;
    let handle: string | undefined;

    if (idCandidate.includes('.')) {
      const parts = idCandidate.split('.');
      id = parts[0];
      handle = parts[1];
    } else if (this.current.type === 'COLON') {
      this.advance();
      handle = this.expect('ID').value;
    }

    return { id, handle };
  }

  private parseLiteral(val: string): any {
    if (val === 'true') return true;
    if (val === 'false') return false;
    const n = parseFloat(val);
    // Flexible numeric check: Valid number and matches standard numeric pattern
    if (!isNaN(n) && isFinite(n) && /^[ \t]*[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?[ \t]*$/.test(val)) {
        return n;
    }
    return val;
  }

  private buildGraph(): InjectableGraph {
    const graph: InjectableGraph = { 
        nodes: [], 
        edges: [],
        hasExplicitPositions: this.hasExplicitPositions
    };
    const tempToFinal = new Map<string, string>();

    // Step 1: Create all nodes
    let nodeIndex = 0;
    this.nodes.forEach((raw, tempId) => {
      // Resolve Node Type (with Alias support)
      let def = NODE_DEFINITIONS.find(d => d.id === raw.id);
      if (!def) {
          def = NODE_DEFINITIONS.find(d => d.aliases?.includes(raw.id.toLowerCase()));
      }
      
      if (!def) {
        this.diagnostics.push(`Unknown Node Type: ${raw.id}`);
        return;
      }

      console.debug(`[IOGL Parser] Processing [${raw.label || 'anon'}] Type [${raw.id}] Props:`, raw.props);

      const finalId = generateNodeId(def.id);
      tempToFinal.set(tempId, finalId);

      const data = { ...def.defaultData, label: raw.label || def.label } as Record<string, any>;
      
      // Resolve Manifest (Case-Insensitive)
      const manifest = IOGL_MANIFEST[def.id] || IOGL_MANIFEST[def.id.toUpperCase()];
      if (manifest) {
        // Apply Mode
        if (raw.props.mode !== undefined) {
          const modeVal = raw.props.mode;
          const modeProp = manifest.modeProperty || 'mode';
          if (manifest.modeMapping && manifest.modeMapping[modeVal] !== undefined) {
            data[modeProp] = manifest.modeMapping[modeVal];
          } else {
            data[modeProp] = modeVal;
          }
        }
        
        // Apply Positional Data
        if (raw.props.data !== undefined) {
          const positionalData = Array.isArray(raw.props.data) 
            ? raw.props.data 
            : [raw.props.data];

          const schema = manifest.data;
          if (schema) {
            let keys: string[] = [];
            if (Array.isArray(schema)) {
                keys = schema;
            } else {
                const currentMode = String(data[manifest.modeProperty || 'mode'] || '');
                keys = (schema as any)[currentMode] || [];
            }
            keys.forEach((key, i) => {
              if (positionalData[i] !== undefined) {
                  data[key] = positionalData[i];
              }
            });
          }
        }

        // --- Fidelity Guard: Auto-wrap values for Engine consumption ---
        if (manifest.wrapPayload) {
            const propName = typeof manifest.wrapPayload === 'string' ? manifest.wrapPayload : 'value';
            const pt = manifest.payloadType || 'scalar';
            
            // Robust Check: If data[propName] is a raw value (not a NodePayload), we wrap it.
            const val = data[propName];
            const isPayload = val && typeof val === 'object' && !Array.isArray(val) && ('type' in val) && ('value' in val);
            
            if (val !== undefined && !isPayload) {
                if (pt === 'boolean') {
                    // Robust boolean conversion (supports 1, "true", true)
                    const boolVal = val === true || val === 'true' || val === 1 || val === '1';
                    data[propName] = PayloadUtils.wrap(boolVal);
                } else if (pt === 'scalar') {
                    data[propName] = PayloadUtils.createScalar(this.parseLiteral(String(val)));
                } else if (pt === 'array') {
                    // Ensure matrix string is parsed before validation
                    let parsedVal = val;
                    if (typeof val === 'string') {
                        try {
                            parsedVal = JSON.parse(val);
                        } catch (e) {
                            parsedVal = val; // Fallback to raw for validation check
                        }
                    }

                    const checkNumeric = (arr: any): boolean => {
                        if (!Array.isArray(arr)) {
                            // Trim whitespace for string numbers
                            const n = typeof arr === 'string' ? parseFloat(arr.trim()) : arr;
                            return typeof n === 'number' && !isNaN(n);
                        }
                        return arr.every(item => checkNumeric(item));
                    };

                    if (!checkNumeric(parsedVal)) {
                        const msg = `ERROR: Matrix [${raw.label || raw.id}] contains invalid non-numeric values (e.g. symbols). Injection blocked.`;
                        this.diagnostics.push(msg);
                        console.warn(`[IOGL Parser] ${msg}`, parsedVal);
                        
                        // Revert to defaultData for this property AND ensure it's wrapped correctly
                        const defaultRaw = def?.defaultData?.[propName];
                        const defaultParsed = typeof defaultRaw === 'string' ? JSON.parse(defaultRaw) : defaultRaw;
                        data[propName] = PayloadUtils.createArray(defaultParsed);
                    } else {
                        data[propName] = PayloadUtils.createArray(parsedVal);
                    }
                } else if (pt === 'color') {
                    data[propName] = ColorUtils.standardize(String(val));
                } else if (pt === 'string') {
                    data[propName] = PayloadUtils.createString(String(val));
                }
            }
        }

        // Apply Fixed Data Injection
        if (manifest.fixedData) {
            Object.assign(data, manifest.fixedData);
        }

        // Apply Auxiliary Props
        if (manifest.auxiliary) {
          manifest.auxiliary.forEach(key => {
            if (raw.props[key] !== undefined) data[key] = raw.props[key];
          });
        }
        
        // Final direct prop application (backfill)
        Object.keys(raw.props).forEach(key => {
            if (key !== 'mode' && key !== 'data' && data[key] === undefined) {
                data[key] = raw.props[key];
            }
        });
      }

      const defaultX = 20 + (nodeIndex * 20) % 400;
      const defaultY = 20 + (nodeIndex * 50) % 600;
      nodeIndex++;

      graph.nodes.push({ 
        id: finalId, 
        type: def.id, 
        position: { 
            x: raw.x !== undefined ? raw.x : defaultX, 
            y: raw.y !== undefined ? raw.y : defaultY 
        }, 
        data 
      });
    });

    // Step 2: Create all edges
    this.edges.forEach(raw => {
      const sourceTempId = this.labelToId.get(raw.source);
      const targetTempId = this.labelToId.get(raw.target);

      if (!sourceTempId || !targetTempId) {
        this.diagnostics.push(`Edge error: Node '${!sourceTempId ? raw.source : raw.target}' not found`);
        return;
      }

      const sourceId = tempToFinal.get(sourceTempId);
      const targetId = tempToFinal.get(targetTempId);
      
      if (!sourceId || !targetId) return;

      graph.edges.push({
        id: generateEdgeId(),
        source: sourceId,
        sourceHandle: this.resolveHandle(raw.sourceHandle, sourceTempId, true),
        target: targetId,
        targetHandle: this.resolveHandle(raw.targetHandle, targetTempId, false),
        type: 'magnetic',
        data: { pathType: 'bezier', animate: false }
      });
    });

    return graph;
  }

  private resolveHandle(handle: string | undefined, tempId: string, isSource: boolean): string {
    const h = (handle || '').toLowerCase();
    
    // Support .a, .b, .c, .d Dynamic Mapping
    const match = h.match(/^([a-z]|out|in|val|res)$/);
    if (match) {
        let char = match[1];
        // Normalize out/val/res/in to 'a'
        if (char === 'out' || char === 'val' || char === 'res' || char === 'in') char = 'a';
        return (isSource ? 'out_' : 'in_') + char;
    }

    return handle || (isSource ? 'out_a' : 'in_a');
  }
}
