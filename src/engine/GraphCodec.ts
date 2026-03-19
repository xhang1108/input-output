import { NodeDefinition } from '../types/NodeDefinition';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';
import { InjectableGraph } from './types';
import { Edge } from '@xyflow/react';
import { generateNodeId, generateEdgeId } from '../utils/idGenerator';
import { PayloadUtils } from '../utils/PayloadUtils';

interface IOGLNode {
    id: string;      // Internal unique ID (e.g. node_123)
    alias: string;   // User-defined name in IOGL (e.g. Builder)
    category: string;
    opCode?: string;
    x?: number;
    y?: number;
    value?: unknown;
}

interface IOGLConnection {
    id?: string;
    sourceAlias: string;  // Explicit alias from IOGL
    sourceHandle?: string;
    targetAlias: string;  // Explicit alias from IOGL
    targetHandle: string;
    line?: number;
}

type TokenType = 'ID' | 'COLON' | 'AT' | 'COMMA' | 'EQUALS' | 'ARROW' | 'LBRACKET' | 'RBRACKET' | 'NEWLINE' | 'EOF' | 'MULTILINE_STRING' | 'RAW_VALUE' | 'UNKNOWN';

interface Token {
    type: TokenType;
    value: string;
    line: number;
    col: number;
}

class IOGLLexer {
    private pos = 0;
    private line = 1;
    private col = 1;

    constructor(private input: string) { }

    private advance() {
        if (this.pos < this.input.length) {
            if (this.input[this.pos] === '\n') {
                this.line++;
                this.col = 1;
            } else {
                this.col++;
            }
            this.pos++;
        }
    }

    private skipWhitespace() {
        while (this.pos < this.input.length && /[ \t\r]/.test(this.input[this.pos])) {
            this.advance();
        }
    }

    private skipComment() {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
            this.advance();
        }
    }

    private charToken(type: TokenType): Token {
        const token = { type, value: this.input[this.pos], line: this.line, col: this.col };
        this.advance();
        return token;
    }

    public readNext(): Token {
        this.skipWhitespace();

        if (this.pos >= this.input.length) return { type: 'EOF', value: '', line: this.line, col: this.col };

        const char = this.input[this.pos];

        if (char === '\n') {
            const token: Token = { type: 'NEWLINE', value: '\n', line: this.line, col: this.col };
            this.advance();
            return token;
        }

        if (char === '#') {
            this.skipComment();
            return this.readNext();
        }

        if (this.input.startsWith('--', this.pos) || this.input.startsWith('->', this.pos)) {
            const val = this.input.substring(this.pos, this.pos + 2);
            const token: Token = { type: 'ARROW', value: val, line: this.line, col: this.col };
            this.advance(); this.advance();
            return token;
        }

        if (char === ':') return this.charToken('COLON') as Token;
        if (char === '@') return this.charToken('AT') as Token;
        if (char === '=') return this.charToken('EQUALS') as Token;
        if (char === ',') return this.charToken('COMMA') as Token;
        if (char === '[') return this.charToken('LBRACKET') as Token;
        if (char === ']') return this.charToken('RBRACKET') as Token;

        // String Literals (User preference: Single double-quotes for everything)
        if (char === '"') {
            const startLine = this.line;
            const startCol = this.col;
            this.advance();
            let val = '';
            while (this.pos < this.input.length) {
                if (this.input[this.pos] === '\\' && this.input[this.pos + 1] === '"') {
                    val += '"';
                    this.advance();
                    this.advance();
                    continue;
                }
                if (this.input[this.pos] === '"') {
                    break;
                }
                val += this.input[this.pos];
                this.advance();
            }
            if (this.input[this.pos] === '"') this.advance();
            return { type: 'RAW_VALUE', value: val, line: startLine, col: startCol } as Token;
        }

        if (/[a-zA-Z0-9_\-\.\[\]]/.test(char)) {
            let val = '';
            const startCol = this.col;
            while (this.pos < this.input.length && /[a-zA-Z0-9_\-\.\[\]]/.test(this.input[this.pos])) {
                val += this.input[this.pos];
                this.advance();
            }
            return { type: 'ID', value: val, line: this.line, col: startCol } as Token;
        }

        const token: Token = { type: 'UNKNOWN', value: char, line: this.line, col: this.col };
        this.advance();
        return token;
    }

    public readValue(): Token {
        this.skipWhitespace();
        if (this.pos >= this.input.length) return { type: 'EOF', value: '', line: this.line, col: this.col };

        // readNext already handles double-quoted strings correctly as RAW_VALUE
        if (this.input[this.pos] === '"') {
            return this.readNext();
        }

        const startCol = this.col;
        const startLine = this.line;
        let val = '';
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
            if (this.input[this.pos] === '#') break;
            val += this.input[this.pos];
            this.advance();
        }
        return { type: 'RAW_VALUE', value: val.trim(), line: startLine, col: startCol } as Token;
    }
}

class IOGLParser {
    private lexer: IOGLLexer;
    private currentToken: Token;

    public nodes: Map<string, IOGLNode> = new Map(); // Key = Internal ID
    public aliasToId: Map<string, string> = new Map(); // Key = Alias, Value = Internal ID
    public edges: IOGLConnection[] = [];
    public diagnostics: string[] = [];

    private declaredEdges = new Set<string>();
    private occupiedHandles = new Map<string, Set<string>>(); // Key = Internal ID
    private handleCounts = new Map<string, number>(); // Key = Internal ID
    private nodeCounter = 0;

    constructor(private input: string) {
        this.lexer = new IOGLLexer(input);
        this.currentToken = this.lexer.readNext();
    }

    private advance() {
        this.currentToken = this.lexer.readNext();
    }

    public parse() {
        const lineData = this.collectLines();

        // Pass 1: Node Definitions
        for (const line of lineData) {
            if (!line.hasArrow) {
                this.parseNodeLine(line.tokens);
            }
        }

        // Pass 2: Edge Definitions
        for (const line of lineData) {
            if (line.hasArrow) {
                this.parseEdgeLine(line.tokens);
            }
        }
    }

    private collectLines(): { tokens: Token[], hasArrow: boolean }[] {
        const lines: { tokens: Token[], hasArrow: boolean }[] = [];
        while (this.currentToken.type !== 'EOF') {
            if (this.currentToken.type === 'NEWLINE') {
                this.advance();
                continue;
            }

            const tokens: Token[] = [];
            let hasArrow = false;

            // Greedily collect ALL tokens on the same line
            while ((this.currentToken.type as any) !== 'NEWLINE' && (this.currentToken.type as any) !== 'EOF') {
                if (this.currentToken.type !== 'UNKNOWN') {
                    if (this.currentToken.type === 'ARROW') hasArrow = true;
                    tokens.push({ ...this.currentToken });
                }
                this.advance();
            }

            if (tokens.length > 0) {
                lines.push({ tokens, hasArrow });
            }
        }
        return lines;
    }

    private parseHandleSuffix(tokens: Token[], startIndex: number): { suffix: string, nextIndex: number } {
        let idx = startIndex;
        let suffix = "";
        if (idx < tokens.length && tokens[idx].type === 'LBRACKET') {
            idx++;
            if (idx < tokens.length && tokens[idx].type === 'ID') {
                suffix = `[${tokens[idx].value}]`;
                idx++;
                if (idx < tokens.length && tokens[idx].type === 'RBRACKET') {
                    idx++;
                } else {
                    this.diagnostics.push(`Line ${tokens[0].line}: Missing closing bracket ']'`);
                }
            }
        }
        return { suffix, nextIndex: idx };
    }

    private parseNodeRef(tokens: Token[], startIndex: number): { alias: string, handle?: string, nextIndex: number } | null {
        let idx = startIndex;
        if (idx >= tokens.length || tokens[idx].type !== 'ID') return null;

        let alias = tokens[idx].value;
        idx++;

        let handleSuffixObj = this.parseHandleSuffix(tokens, idx);
        let bracketSuffix = handleSuffixObj.suffix;
        idx = handleSuffixObj.nextIndex;

        let handle: string | undefined = bracketSuffix ? bracketSuffix : undefined;

        if (idx < tokens.length && tokens[idx].type === 'COLON') {
            idx++;
            if (idx < tokens.length && tokens[idx].type === 'ID') {
                handle = tokens[idx].value;
                idx++;
                let hSuffixObj = this.parseHandleSuffix(tokens, idx);
                handle += hSuffixObj.suffix;
                idx = hSuffixObj.nextIndex;
            } else {
                this.diagnostics.push(`Line ${tokens[0].line}: Expected handle name after ':'`);
            }
        }

        return { alias, handle, nextIndex: idx };
    }

    private parseEdgeLine(tokens: Token[]) {
        let idx = 0;
        const sourceRef = this.parseNodeRef(tokens, idx);
        if (!sourceRef) {
            this.diagnostics.push(`Line ${tokens[0].line}: Invalid source node in edge`);
            return;
        }

        idx = sourceRef.nextIndex;
        if (idx >= tokens.length || tokens[idx].type !== 'ARROW') {
            this.diagnostics.push(`Line ${tokens[0].line}: Expected '--' or '->' in edge`);
            return;
        }
        idx++;

        const targetRef = this.parseNodeRef(tokens, idx);
        if (!targetRef) {
            this.diagnostics.push(`Line ${tokens[0].line}: Invalid target node in edge`);
            return;
        }

        const sourceAlias = sourceRef.alias;
        const targetAlias = targetRef.alias;

        // Q3: Strict Ghost Nodes Check (checked against aliases)
        if (!this.aliasToId.has(sourceAlias)) {
            this.diagnostics.push(`Error: Source Node '${sourceAlias}' is not declared at line ${tokens[0].line}`);
            return;
        }
        if (!this.aliasToId.has(targetAlias)) {
            this.diagnostics.push(`Error: Target Node '${targetAlias}' is not declared at line ${tokens[0].line}`);
            return;
        }

        const targetId = this.aliasToId.get(targetAlias)!;

        // Q8: Strict Positional Linking Priority & Dynamic Append
        let targetHandle = targetRef.handle;
        if (!targetHandle || targetHandle.toLowerCase() === 'append') {
            const count = this.handleCounts.get(targetId) || 0;

            // If explicit 'append', use the next index
            if (targetHandle?.toLowerCase() === 'append') {
                targetHandle = `[${count}]`;
            } else {
                // Standard positional linking (append style but check occupancy for first handle)
                let occupied = this.occupiedHandles.get(targetId);
                if (occupied && occupied.size > 0 && count === 0) {
                    this.diagnostics.push(`Line ${tokens[0].line}: Ambiguous connection, target handle is occupied for '${targetAlias}'`);
                    return;
                }
                targetHandle = `in_a`; // Default for positional
                if (count > 0) targetHandle = `[${count}]`;
            }

            this.handleCounts.set(targetId, count + 1);
        }

        // For conversion, we store raw edge info using ALIASES
        this.edges.push({
            id: `e-iogl-${tokens[0].line}-${Math.random().toString(36).substr(2, 4)}`,
            sourceAlias,
            sourceHandle: sourceRef.handle,
            targetAlias,
            targetHandle,
            line: tokens[0].line
        });
    }

    private parseNodeLine(tokens: Token[]) {
        if (tokens.length === 0 || tokens[0].type !== 'ID') {
            const firstToken = tokens.length > 0 ? `${tokens[0].type} (${tokens[0].value})` : 'nothing';
            this.diagnostics.push(`Line ${tokens.length > 0 ? tokens[0].line : 0}: Invalid node definition (Found ${firstToken})`);
            return;
        }

        const alias = tokens[0].value;
        if (this.aliasToId.has(alias)) {
            this.diagnostics.push(`Fatal Error: Duplicate Node ID detected '${alias}' at line ${tokens[0].line}`);
            return;
        }

        const internalId = `temp_${this.nodeCounter++}_${Math.random().toString(36).substr(2, 4)}`;
        this.aliasToId.set(alias, internalId);

        let category = '';
        let opCode = '';
        let x: number | undefined;
        let y: number | undefined;
        let value: any = undefined;

        // Find primary delimiters
        const equalsIdx = tokens.findIndex(t => t.type === 'EQUALS');
        const atIdx = tokens.findIndex(t => t.type === 'AT');

        // 1. Coordinates (Anywhere on the line)
        if (atIdx !== -1 && atIdx + 1 < tokens.length) {
            x = parseFloat(tokens[atIdx + 1].value);
            if (atIdx + 3 < tokens.length && tokens[atIdx + 2].type === 'COMMA') {
                y = parseFloat(tokens[atIdx + 3].value);
            }
        }

        // 2. Type Info (Between Alias and either '=' or '@')
        const typeLimit = equalsIdx !== -1 ? equalsIdx : (atIdx !== -1 ? atIdx : tokens.length);
        const typeTokens = tokens.slice(0, typeLimit);
        const colonIndices = typeTokens.map((t, i) => t.type === 'COLON' ? i : -1).filter(i => i !== -1);
        if (colonIndices.length > 0) {
            category = typeTokens[colonIndices[0] + 1]?.value || '';
            if (colonIndices.length > 1) {
                opCode = typeTokens[colonIndices[1] + 1]?.value || '';
            }
        }

        // 3. Value Extraction (After '=' until end of line or '@' if it follows)
        if (equalsIdx !== -1) {
            const valueEndIdx = (atIdx !== -1 && atIdx > equalsIdx) ? atIdx : tokens.length;
            const valSegments = tokens.slice(equalsIdx + 1, valueEndIdx);

            if (valSegments.length === 1 && (valSegments[0].type === 'RAW_VALUE' || valSegments[0].type === 'MULTILINE_STRING')) {
                value = GraphCodec.parseValue(valSegments[0].value);
            } else if (valSegments.length > 0) {
                // If it's a series of tokens (e.g. JSON brackets), join them with space.
                // parseValue is robust enough to handle the result.
                const combined = valSegments.map(t => t.value).join(' ');
                value = GraphCodec.parseValue(combined);
            }
        }

        this.nodes.set(internalId, {
            id: internalId,
            alias: alias,
            category,
            opCode,
            x,
            y,
            value
        });
    }
}

export class GraphCodec {
    // ─── Parsing ─────────────────────────────────────────────────────────────

    public static parse(IOGL: string): { graph: InjectableGraph, diagnostics: string[] } {
        const parser = new IOGLParser(IOGL);
        parser.parse();
        const graph = this.convertToInjectable(parser.nodes, parser.edges, parser.aliasToId, parser.diagnostics);
        return { graph, diagnostics: parser.diagnostics };
    }

    public static parseValue(valStr: string): unknown {
        // Try number
        const num = parseFloat(valStr);
        if (!isNaN(num) && valStr.trim() === num.toString()) return num;

        // Try boolean
        if (valStr.toLowerCase() === 'true') return true;
        if (valStr.toLowerCase() === 'false') return false;

        // String (strip quotes if explicit)
        if (valStr.startsWith('"') && valStr.endsWith('"')) {
            return valStr.slice(1, -1);
        }

        // Try JSON Array or Object
        if ((valStr.trim().startsWith('[') && valStr.trim().endsWith(']')) ||
            (valStr.trim().startsWith('{') && valStr.trim().endsWith('}'))) {
            try {
                return JSON.parse(valStr);
            } catch (e) {
                return valStr;
            }
        }

        return valStr;
    }

    // ─── Conversion ──────────────────────────────────────────────────────────

    private static convertToInjectable(IOGLNodes: Map<string, IOGLNode>, IOGLConns: IOGLConnection[], aliasToId: Map<string, string>, diagnostics: string[]): InjectableGraph {
        const graph: InjectableGraph = { nodes: [], edges: [] };
        const idMap = new Map<string, string>(); // tempId -> finalSemanticId

        // 1. Convert Nodes
        IOGLNodes.forEach(cNode => {
            const typeInfo = this.resolveType(cNode.category, cNode.opCode);

            if (!typeInfo) {
                diagnostics.push(`Node "${cNode.alias}": Unknown category:opcode "${cNode.category}:${cNode.opCode}"`);
                return;
            }

            // Generate Final Semantic ID using nanoid
            const finalId = generateNodeId(typeInfo.id);
            idMap.set(cNode.id, finalId);

            // Update aliasToId for edges if needed, but we'll use idMap for edge resolution

            // Merge default data using OpCode if needed
            const data = { ...((typeInfo.defaultData || {}) as Record<string, unknown>) } as Record<string, unknown>;

            // Set User-defined name as Label
            data.label = cNode.alias;

            // If value is provided, override appropriate field with strict type validation
            if (cNode.value !== undefined) {
                let validValue = cNode.value;

                // Strict Type Validation
                if (typeInfo.id === 'IN-01' || typeInfo.id === 'IN-02') {
                    if (typeof cNode.value !== 'number') {
                        diagnostics.push(`Node "${cNode.alias}": Value "${cNode.value}" is invalid for ${typeInfo.id}. Expected number. Defaulting to 0.`);
                        validValue = 0;
                    }
                } else if (typeInfo.id === 'IN-05') { // Button
                    if (typeof cNode.value !== 'boolean') {
                        diagnostics.push(`Node "${cNode.alias}": Value "${cNode.value}" is invalid for ${typeInfo.id}. Expected boolean. Defaulting to false.`);
                        validValue = false;
                    }
                } else if (typeInfo.id === 'IN-04') { // String
                    validValue = String(cNode.value);
                }

                // Update cNode.value to the validated value so Brain gets the safe initialValue
                cNode.value = validValue;

                // Map to specific data field based on node type
                if (typeInfo.id === 'IN-01') data.value = validValue;
                else if (typeInfo.id === 'IN-02') data.value = validValue;
                else if (typeInfo.id === 'IN-06') data.val = validValue;
                else if (typeInfo.id === 'IN-05') data.value = validValue;
                else if (typeInfo.id === 'IN-09') data.code = validValue;
                else if (typeInfo.id === 'UT-01') data.markdown = validValue; // Sticky Node mapping (UI component uses 'markdown')
                else if (typeInfo.id === 'IN-07') {
                    // MatrixInputNode expects 2D array [[x, y, z]]. 
                    // If we got 1D [x, y, z] wrap it.
                    let matrixVal = validValue;
                    if (Array.isArray(matrixVal) && matrixVal.length > 0 && !Array.isArray(matrixVal[0])) {
                        matrixVal = [matrixVal];
                    }
                    data.rawExpression = typeof matrixVal === 'string' ? matrixVal : JSON.stringify(matrixVal);
                }
                else if (typeInfo.id.startsWith('IN')) data.value = validValue;

                // SPECIAL: If the node is Random (IN-10) and the value suggests a mode, set it.
                // This allows io:rand = "vector" to work directly.
                if (typeInfo.id === 'IN-10' && typeof validValue === 'string') {
                    if (['float', 'vector', 'matrix'].includes(validValue.toLowerCase())) {
                        data.mode = validValue.toLowerCase();
                    }
                }

                // SPECIAL: If value is a JSON object, merge it directly into data fields
                if (typeof validValue === 'object' && validValue !== null && !Array.isArray(validValue)) {
                    Object.assign(data, validValue);
                }
            }

            // Override OpCode if specified (e.g. math:SUB)
            // Even though resolveType might have found the definition, ensuring 'op' is set correctly is safe
            if (cNode.opCode && (typeInfo.category === 'Math')) {
                // Standardize OpCode to UpperCase for internal logic
                data.op = cNode.opCode.toUpperCase();
            }

            // Data Family Mapping
            if (cNode.opCode && typeInfo.category.includes('Data')) {
                const op = cNode.opCode.toLowerCase();
                if (typeInfo.id === 'DT-03') {
                    const opMap: Record<string, string> = { 'sort (asc)': 'Sort (Asc)', 'sort': 'Sort (Asc)', 'sort (desc)': 'Sort (Desc)', 'reverse': 'Reverse', 'unique': 'Unique', 'clean': 'Clean' };
                    if (opMap[op]) data.mode = opMap[op];
                } else if (typeInfo.id === 'DT-04') {
                    const opMap: Record<string, string> = { 'union': 'Union', 'intersection': 'Intersection', 'difference': 'Difference' };
                    if (opMap[op]) data.mode = opMap[op];
                } else if (typeInfo.id === 'DT-06') {
                    if (op === 'combine') data.mode = 'combine';
                    if (op === 'separate' || op === 'split') data.mode = 'separate';
                    cNode.value = data.mode;
                } else if (typeInfo.id === 'DT-05' || typeInfo.id === 'DT-07') {
                    // Standardize Matrix/Vector OpCodes to Uppercase
                    data.op = op.toUpperCase();
                }
            }

            // Calculus Family Mapping
            if (typeInfo.category === 'Calculus') {
                if (cNode.value !== undefined) {
                    // For calculus nodes, value is the expression string
                    data.expression = String(cNode.value);
                }
            }

            // Logic Family Mapping
            if (cNode.opCode && typeInfo.id === 'LG-01') {
                data.op = cNode.opCode.toUpperCase();
                // We keep the alias as the label, but for basic gates, maybe OP is clearer?
                // User requirement said "NANID produced, we change node name"
            }

            graph.nodes.push({
                id: finalId,
                type: typeInfo.id,
                position: { x: cNode.x ?? 0, y: cNode.y ?? 0 },
                data: data,
                value: cNode.value // Initial Value for Brain
            });
        });

        // 2. Convert Edges
        const declaredEdges = new Set<string>();
        IOGLConns.forEach((conn, idx) => {
            const tempSourceId = aliasToId.get(conn.sourceAlias);
            const tempTargetId = aliasToId.get(conn.targetAlias);

            if (!tempSourceId || !tempTargetId) return;

            const sourceId = idMap.get(tempSourceId);
            const targetId = idMap.get(tempTargetId);

            if (!sourceId || !targetId) return;

            // Determine correct source handle based on Source Node Type
            // Most are 'out', but MA-03 (Constant) uses 'val'.
            let sourceHandle = conn.sourceHandle || 'out';

            // If no explicit sourceHandle, try to intelligently infer it from the definition.
            if (!conn.sourceHandle) {
                const sourceCNode = IOGLNodes.get(tempSourceId);
                if (sourceCNode) {
                    const def = this.resolveType(sourceCNode.category, sourceCNode.opCode);
                    if (def && def.handles) {
                        // Dynamic Source Inference (Special Case for Vector Split)
                        if (def.id === 'DT-06') {
                            const op = (sourceCNode.opCode || '').toUpperCase();
                            sourceHandle = (op === 'COMBINE') ? 'out' : 'x';
                        } else {
                            const sourceDef = def.handles.find(h => h.type === 'source');
                            if (sourceDef) {
                                sourceHandle = sourceDef.id;
                            }
                        }
                    }
                }
            } else {
                // Phase 2.17: Support Source Handle Aliases
                const sourceCNode = IOGLNodes.get(tempSourceId);
                const sourceDef = sourceCNode ? this.resolveType(sourceCNode.category, sourceCNode.opCode) : undefined;
                sourceHandle = this.resolveHandleAlias(conn.sourceHandle, sourceDef?.id, true);
            }

            const targetCNode = IOGLNodes.get(tempTargetId);
            const targetDef = targetCNode ? this.resolveType(targetCNode.category, targetCNode.opCode) : undefined;
            const resolvedTarget = this.resolveHandleAlias(conn.targetHandle, targetDef?.id, false);

            // Q7: Strict Duplicate Edge Detection (AFTER handle aliasing)
            const edgeKey = `${sourceId}:${sourceHandle}->${targetId}:${resolvedTarget}`;
            if (declaredEdges.has(edgeKey)) {
                diagnostics.push(`Fatal Error: Duplicate Edge declared at line ${conn.line || 'unknown'} (${edgeKey})`);
                return;
            }
            declaredEdges.add(edgeKey);

            graph.edges.push({
                id: generateEdgeId(),
                source: sourceId,
                sourceHandle: sourceHandle,
                target: targetId,
                targetHandle: resolvedTarget,
                type: 'magnetic',
                data: { pathType: 'bezier', animate: false }
            });

            console.log(`[GraphCodec] Edge ${String(idx)}: ${sourceId}:${sourceHandle} -> ${targetId}:${resolvedTarget}`);
        });

        return graph;
    }

    private static resolveHandleAlias(handle: string, typeId?: string, isSource: boolean = false): string {
        // Skip aliasing for Expert nodes (SY-05, etc.)
        if (typeId?.startsWith('SY-')) return handle;

        const h = handle.toLowerCase();

        // 1. Vector Split (DT-06) - RAW HANDLE PASS-THROUGH
        if (typeId === 'DT-06') {
            if (['x', 'y', 'z', 'in', 'out'].includes(h)) return h;
        }

        // 2. Common Math Aliases (MA-01 uses in_a, in_b)
        if (!isSource) {
            // Standardize first input handle for Math/Logic/Calculus families
            if (['a', 'in', 'in_a'].includes(h)) {
                if (typeId?.startsWith('MA-') || typeId?.startsWith('LG-') || typeId?.startsWith('CL-') || typeId?.startsWith('TR-')) {
                    if (['MA-01', 'MA-02', 'MA-05', 'MA-07', 'LG-01', 'TR-03'].includes(typeId)) return 'in_a';
                    if (['MA-03', 'MA-04', 'MA-06', 'CL-04', 'TR-01'].includes(typeId)) return 'in';
                    if (['CL-01', 'CL-02', 'CL-03', 'CL-05', 'TR-04'].includes(typeId)) return 'expr';
                    return 'in_a'; // Fallback
                }
            }

            // Support for Capsule/Dynamic Array Indexing
            if (/^\[(\d+)\]$/.test(h)) {
                return 'in';
            }

            // Allow standard a/b aliasing for all nodes unless they explicitly use raw a/b
            // This fix ensures that DT-05 (Vector Utils) can use 'a' and 'b' aliases correctly.
            // if (typeId?.startsWith('DT-')) {
            //     if (['a', 'b', 'data'].includes(h)) return h;
            // }

            if (h === 'a') return 'in_a';
            if (h === 'b') return 'in_b';
            if (h === 'base') return 'in_a';
            if (h === 'exp') return 'in_b';

            // 3. Linear Algebra Aliases (x, y, z -> in_x, in_y, in_z) for standard matrix inputs
            if (['x', 'y', 'z'].includes(h)) {
                return `in_${h}`;
            }

            // Array/List operations
            if (typeId === 'DT-01' && h === 'append') return 'in'; // Magic handle for builder
            if (typeId === 'DT-02' && (h === 'array' || h === 'list' || h === 'in')) return 'in';
            if (typeId === 'DT-03' && (h === 'array' || h === 'list' || h === 'in')) return 'in';
            if (typeId === 'DT-04' && (h === 'in_a' || h === 'setA' || h === 'a')) return 'in_a';
            if (typeId === 'DT-04' && (h === 'in_b' || h === 'setB' || h === 'b')) return 'in_b';

            // Nodes whose primary visual target handle is 'data' instead of 'in'
            if (typeId === 'LG-03' || typeId === 'TR-05' || typeId === 'TR-06') {
                if (h === 'in' || h === 'input' || h === 'data') return 'data';
            }

            // Semantic mappings
            if (h === 'cond' || h === 'if' || h === 'sel') return 'condition';
            if (h === 't' || h === 'true') return 'in_true';
            if (h === 'f' || h === 'false') return 'in_false';

            // Generic aliases
            let resolved = h;
            if (h === 'in' || h === 'input' || h === 'data') resolved = 'in';

            // Wireless link immunity: Cross-reference with strict NODE_DEFINITIONS
            if (typeId) {
                const def = NODE_DEFINITIONS.find(d => d.id === typeId);
                if (def) {
                    const targets = def.handles.filter(x => x.type === 'target');
                    if (!targets.some(x => x.id === resolved)) {
                        // The requested port doesn't exist on this node!
                        // If asking for a generic input port but node only has 'in_a', 'expr', or 'data', auto-map to the first valid port.
                        if (targets.length === 1) return targets[0].id;
                        if (['in', 'data', 'input', 'a', 'x', 'expr'].includes(resolved) && targets.length > 0) {
                            return targets[0].id;
                        }
                    }
                }
            }
            return resolved;
        }

        // 4. Source aliases
        let resolved = h;
        if (h === 'val' || h === 'ans' || h === 'res' || h === 'out' || h === 'result' || h === 'output') {
            resolved = 'out';
        }

        // Wireless link immunity for sources
        if (typeId) {
            const def = NODE_DEFINITIONS.find(d => d.id === typeId);
            if (def) {
                const sources = def.handles.filter(x => x.type === 'source');
                if (!sources.some(x => x.id === resolved)) {
                    if (sources.length === 1) return sources[0].id;
                    if (['out', 'res', 'result', 'val'].includes(resolved) && sources.length > 0) return sources[0].id;
                }
            }
        }

        return resolved;
    }

    private static resolveType(category: string, opCode?: string): NodeDefinition | undefined {
        // 0. Direct ID Match
        if (!opCode && /^[A-Z]{2,3}-\d{2}$/.test(category)) {
            const match = NODE_DEFINITIONS.find(d => d.id === category);
            if (match) return match;
        }

        const catLower = category.toLowerCase();
        const opLower = opCode?.toLowerCase();

        // 1. Math Family (MA)
        if (catLower === 'math') {
            if (opLower) {
                const exactMatch = NODE_DEFINITIONS.find(d =>
                    d.category === 'Math' &&
                    d.defaultData?.op?.toString().toLowerCase() === opLower
                );
                if (exactMatch) return exactMatch;
            }
            // Explicit Mappings
            if (opLower === 'const') return NODE_DEFINITIONS.find(d => d.id === 'IN-06');
            if (opLower === 'round') return NODE_DEFINITIONS.find(d => d.id === 'MA-05');

            // Standard Math Node (MA-01) for ADD, SUB, etc.
            return NODE_DEFINITIONS.find(d => d.id === 'MA-01');
        }

        // 2. Input/Output Family (IN/OT)
        if (catLower === 'io' || catLower === 'input' || catLower === 'output' || catLower === 'result') {
            if (opLower === 'num' || opLower === 'number') return NODE_DEFINITIONS.find(d => d.id === 'IN-01');
            if (opLower === 'slider') return NODE_DEFINITIONS.find(d => d.id === 'IN-02');
            if (opLower === 'color') return NODE_DEFINITIONS.find(d => d.id === 'IN-03');
            if (opLower === 'string' || opLower === 'str') return NODE_DEFINITIONS.find(d => d.id === 'IN-04');
            if (opLower === 'button' || opLower === 'toggle' || opLower === 'btn') return NODE_DEFINITIONS.find(d => d.id === 'IN-05');
            if (opLower === 'constant' || opLower === 'const') return NODE_DEFINITIONS.find(d => d.id === 'IN-06');
            if (opLower === 'matrix' || opLower === 'mat' || opLower === 'array') return NODE_DEFINITIONS.find(d => d.id === 'IN-07');
            if (opLower === 'abacus') return NODE_DEFINITIONS.find(d => d.id === 'IN-08');
            if (opLower === 'expression' || opLower === 'expr' || opLower === 'formula') return NODE_DEFINITIONS.find(d => d.id === 'IN-09');
            if (opLower === 'random' || opLower === 'rand' || opLower === 'noise') return NODE_DEFINITIONS.find(d => d.id === 'IN-10');
            if (opLower === 'distribution' || opLower === 'dist') return NODE_DEFINITIONS.find(d => d.id === 'IN-10');

            if (opLower === 'res' || opLower === 'result') return NODE_DEFINITIONS.find(d => d.id === 'OT-01');
            if (opLower === 'status') return NODE_DEFINITIONS.find(d => d.id === 'OT-02');
            if (opLower === 'plot' || opLower === 'chart' || opLower === 'graph') return NODE_DEFINITIONS.find(d => d.id === 'OT-03');
            if (opLower === 'debug' || opLower === 'print') return NODE_DEFINITIONS.find(d => d.id === 'OT-04');

            // Fallback: try by ID
            const idMatch = NODE_DEFINITIONS.find(d => d.id.toLowerCase() === opLower);
            if (idMatch) return idMatch;
        }

        // 3. Logic Family (LG)
        if (catLower === 'logic' || catLower === 'lg') {
            if (['and', 'or', 'xor', 'not', 'gate'].includes(opLower || '')) return NODE_DEFINITIONS.find(d => d.id === 'LG-01');
            if (opLower === 'switch') return NODE_DEFINITIONS.find(d => d.id === 'LG-02');
            if (opLower === 'split') return NODE_DEFINITIONS.find(d => d.id === 'LG-03');
            if (opLower === 'toggle') return NODE_DEFINITIONS.find(d => d.id === 'IN-05'); // Button as toggle
            if (opLower === 'button') return NODE_DEFINITIONS.find(d => d.id === 'IN-05');
        }

        // 4. Data & Structures (DT)
        if (catLower.includes('data') || catLower.includes('structure') || catLower === 'dt') {
            if (opLower === 'builder' || opLower === 'concat') return NODE_DEFINITIONS.find(d => d.id === 'DT-01');
            if (opLower === 'extract' || opLower === 'get') return NODE_DEFINITIONS.find(d => d.id === 'DT-02');
            if (opLower === 'list' || opLower === 'sort') return NODE_DEFINITIONS.find(d => d.id === 'DT-03');
            if (opLower === 'set' || opLower === 'union' || opLower === 'intersection') return NODE_DEFINITIONS.find(d => d.id === 'DT-04');
            if (opLower === 'vector' || opLower === 'dot' || opLower === 'cross' || opLower === 'vec') return NODE_DEFINITIONS.find(d => d.id === 'DT-05');
            // 'split' is sometimes used instead of 'vec split'
            if (opLower === 'split' || opLower === 'separate' || opLower === 'combine') return NODE_DEFINITIONS.find(d => d.id === 'DT-06');
            if (opLower === 'matrix' || opLower === 'mat' || opLower === 'det' || opLower === 'inv' || opLower === 'transpose' || opLower === 'trace') return NODE_DEFINITIONS.find(d => d.id === 'DT-07');
        }

        // 5. Calculus (CL)
        if (catLower === 'calculus' || catLower === 'cl') {
            if (opLower === 'derivative' || opLower === 'diff' || opLower === 'deriv') return NODE_DEFINITIONS.find(d => d.id === 'CL-01');
            if (opLower === 'integral' || opLower === 'integrate' || opLower === 'int') return NODE_DEFINITIONS.find(d => d.id === 'CL-02');
            if (opLower === 'limit' || opLower === 'lim') return NODE_DEFINITIONS.find(d => d.id === 'CL-03');
            if (opLower === 'solver' || opLower === 'solve') return NODE_DEFINITIONS.find(d => d.id === 'CL-04');
            if (opLower === 'ode') return NODE_DEFINITIONS.find(d => d.id === 'CL-05');
        }

        // 6. Transform (TR)
        if (catLower === 'transform' || catLower === 'tr') {
            if (opLower === 'unit') return NODE_DEFINITIONS.find(d => d.id === 'TR-01');
            if (opLower === 'base' || opLower === 'hex' || opLower === 'bin') return NODE_DEFINITIONS.find(d => d.id === 'TR-02');
            if (opLower === 'geometry' || opLower === 'shape' || opLower === 'geo') return NODE_DEFINITIONS.find(d => d.id === 'TR-03');
            if (opLower === 'field' || opLower === 'gradient') return NODE_DEFINITIONS.find(d => d.id === 'TR-04');
            if (opLower === 'smoothing' || opLower === 'smooth') return NODE_DEFINITIONS.find(d => d.id === 'TR-05');
            if (opLower === 'statistics' || opLower === 'stats') return NODE_DEFINITIONS.find(d => d.id === 'TR-06');
        }

        // 7. Expert (IN-09)
        if (catLower === 'expert' || catLower === 'sy' || catLower === 'script') {
            return NODE_DEFINITIONS.find(d => d.id === 'IN-09');
        }

        // 8. Utility (UT)
        if (catLower === 'utility') {
            if (opLower === 'note' || opLower === 'sticky') return NODE_DEFINITIONS.find(d => d.id === 'UT-01');
            if (opLower === 'reroute') return NODE_DEFINITIONS.find(d => d.id === 'UT-02');
        }

        // Final Fallback: try direct category match (if category is the ID)
        return NODE_DEFINITIONS.find(d => d.id.toLowerCase() === category.toLowerCase());
    }

    // ─── Encoding ────────────────────────────────────────────────────────────

    public static encode(graph: InjectableGraph): string {
        let iogl = '';
        const idToAlias = new Map<string, string>();

        // 1. Export Nodes
        for (const node of graph.nodes) {
            const data = (node.data || {}) as Record<string, unknown>;
            const alias = (data.label as string) || node.id;
            idToAlias.set(node.id, alias);

            const def = NODE_DEFINITIONS.find(d => d.id === node.type);

            // 2. Standardize Categorization and OpCodes for Export
            let opCode = node.type.toLowerCase(); // Default fallback
            let category = def ? def.category.toLowerCase().split(' ')[0] : 'unknown'; // Standardize: 'Logic & Flow' -> 'logic', 'Data & Structures' -> 'data'

            // --- Standardization Map (Internal ID -> IOGL Opcode) ---
            if (category === 'input') category = 'io';
            if (category === 'utility') category = 'utility';
            if (category === 'transform') category = 'transform';
            if (category === 'calculus') category = 'calculus';

            // IO Family
            if (node.type === 'IN-01') opCode = 'num';
            else if (node.type === 'IN-02') opCode = 'slider';
            else if (node.type === 'IN-03') opCode = 'color';
            else if (node.type === 'IN-04') opCode = 'str';
            else if (node.type === 'IN-05') opCode = 'btn';
            else if (node.type === 'IN-06') opCode = 'const';
            else if (node.type === 'IN-07') opCode = 'mat';
            else if (node.type === 'IN-08') opCode = 'abacus';
            else if (node.type === 'IN-09') opCode = 'expr';
            else if (node.type === 'IN-10') opCode = 'rand';
            else if (node.type === 'OT-01') opCode = 'res';
            else if (node.type === 'OT-02') opCode = 'status';
            else if (node.type === 'OT-03') opCode = 'plot';
            else if (node.type === 'OT-04') opCode = 'debug';

            // Math Family
            else if (category === 'math') {
                opCode = (data.op as string || 'add').toLowerCase();
            }

            // Calculus Family
            else if (node.type === 'CL-01') opCode = 'diff';
            else if (node.type === 'CL-02') opCode = 'int';
            else if (node.type === 'CL-03') opCode = 'lim';
            else if (node.type === 'CL-04') opCode = 'solve';
            else if (node.type === 'CL-05') opCode = 'ode';

            // Data Family
            else if (node.type === 'DT-01') opCode = 'builder';
            else if (node.type === 'DT-02') opCode = 'extract';
            else if (node.type === 'DT-03') opCode = 'list';
            else if (node.type === 'DT-04') opCode = 'set';
            else if (node.type === 'DT-05') opCode = 'vec';
            else if (node.type === 'DT-06') opCode = 'split';
            else if (node.type === 'DT-07') opCode = 'mat';

            // Transform Family
            else if (node.type === 'TR-01') opCode = 'unit';
            else if (node.type === 'TR-02') opCode = 'base';
            else if (node.type === 'TR-03') opCode = 'geo';
            else if (node.type === 'TR-04') opCode = 'field';
            else if (node.type === 'TR-05') opCode = 'smooth';
            else if (node.type === 'TR-06') opCode = (data.op as string || 'mean').toLowerCase();

            // Logic Family
            else if (node.type === 'LG-01') opCode = (data.op as string || 'and').toLowerCase();
            else if (node.type === 'LG-02') opCode = 'switch';
            else if (node.type === 'LG-03') opCode = 'split';

            // Utility Family
            else if (node.type === 'UT-01') opCode = 'note';
            else if (node.type === 'UT-02') opCode = 'reroute';
            else if (node.type === 'MA-07') opCode = 'gcd';


            let valStr = '';
            // Primary Value Extraction
            let primaryValue: any = undefined;

            // Priority 1: Use node.value (the actual payload) if it's an Input or constant type
            const unwrappedValue = PayloadUtils.unwrap(node.value);

            if (node.type === 'IN-01' || node.type === 'IN-02' || node.type === 'IN-04') {
                primaryValue = unwrappedValue;
            } else if (node.type === 'UT-01') {
                // Sticky Node: content is in data.markdown
                primaryValue = data.markdown || unwrappedValue;
            } else if (node.type === 'IN-06') {
                // Constant Node: value might be the evaluated pi/e, but data.val is the source string "pi"
                primaryValue = data.val || unwrappedValue;
            } else if (node.type === 'IN-09') {
                // Expression Node: data.code is the source, unwrappedValue is the result.
                // We ALWAYS want to export the source code.
                primaryValue = data.code || unwrappedValue;
            } else if (node.type.startsWith('CL-')) {
                // Calculus Nodes: uses specific data fields
                primaryValue = data.expression || data.variable || unwrappedValue;
            } else if (node.type === 'IN-07') {
                // Matrix Input: Complex object (array of arrays or mathjs matrix)
                primaryValue = data.rawExpression;
                if (!primaryValue) {
                    if (unwrappedValue && typeof unwrappedValue === 'object' && 'toArray' in (unwrappedValue as any)) {
                        primaryValue = JSON.stringify((unwrappedValue as any).toArray());
                    } else if (Array.isArray(unwrappedValue)) {
                        primaryValue = JSON.stringify(unwrappedValue);
                    } else {
                        primaryValue = unwrappedValue;
                    }
                }
            } else if (typeof unwrappedValue !== 'object' && unwrappedValue !== undefined) {
                // Generic fallback for any primitive value in the payload
                primaryValue = unwrappedValue;
            } else if (unwrappedValue && typeof unwrappedValue === 'object' && 'toArray' in (unwrappedValue as any)) {
                // Preserve multidimensional structure for mathjs matrices
                primaryValue = JSON.stringify((unwrappedValue as any).toArray());
            } else if (Array.isArray(unwrappedValue)) {
                // Preserve array dimensionality
                primaryValue = JSON.stringify(unwrappedValue);
            }

            if (primaryValue !== undefined) {
                const str = String(primaryValue);
                // System strictly uses single double-quotes for everything to keep it simple, so escape internal ones
                const escapedStr = str.replace(/"/g, '\\"');
                valStr = ` = "${escapedStr}"`;
            }

            const x = Math.round(node.position.x);
            const y = Math.round(node.position.y);

            iogl += `${alias}:${category}:${opCode} @${x},${y}${valStr}\n`;
        }

        // 2. Export Edges
        for (const edge of graph.edges) {
            const sourceAlias = idToAlias.get(edge.source) || edge.source;
            const targetAlias = idToAlias.get(edge.target) || edge.target;

            let targetHandle = edge.targetHandle || 'in';
            // Standardize handles for export (Prioritize in_a/in_b over aliases for consistency)
            if (targetHandle === 'a') targetHandle = 'in_a';
            else if (targetHandle === 'b') targetHandle = 'in_b';
            else if (targetHandle.length === 1 && ['x', 'y', 'z', 'w'].includes(targetHandle)) {
                targetHandle = `in_` + targetHandle;
            }

            let targetHandleText = `:${targetHandle}`;

            // Implicit Mode Optimization: If target has ONLY one handle and it's 'in', skip the suffix
            const targetNode = graph.nodes.find(n => n.id === edge.target);
            if (targetNode) {
                const def = NODE_DEFINITIONS.find(d => d.id === targetNode.type);
                const targetHandles = def?.handles.filter(h => h.type === 'target') || [];
                if (targetHandles.length === 1 && targetHandles[0].id === 'in' && targetHandle === 'in') {
                    targetHandleText = '';
                }
            }

            let sourceHandleStr = '';
            if (edge.sourceHandle && !['out', 'val', 'result'].includes(edge.sourceHandle)) {
                sourceHandleStr = `:${edge.sourceHandle}`;
            }

            iogl += `${sourceAlias}${sourceHandleStr} -- ${targetAlias}${targetHandleText}\n`;
        }

        return iogl;
    }
}

