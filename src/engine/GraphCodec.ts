import { NodeDefinition } from '../types/NodeDefinition';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';
import { InjectableGraph } from './types';
import { Edge } from '@xyflow/react';

interface CGLNode {
    id: string;
    category: string;
    opCode?: string;
    x?: number;
    y?: number;
    value?: unknown;
}

interface CGLConnection {
    sourceId: string;
    sourceHandle?: string;
    targetId: string;
    targetHandle: string;
}

export class GraphCodec {
    // ─── Parsing ─────────────────────────────────────────────────────────────

    public static parse(cgl: string): { graph: InjectableGraph, diagnostics: string[] } {
        const lines = cgl.split('\n');
        const diagnostics: string[] = [];
        const nodes = new Map<string, CGLNode>();
        const connections: CGLConnection[] = [];

        // Regex Patterns: ID:Category:OpCode @ X, Y = Value (Allows spaces around @ and ,)
        const nodeRegex = /^([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?(?:\s*@\s*(-?\d+)\s*,\s*(-?\d+))?(?:\s*=\s*(.*))?$/;

        for (let i = 0; i < lines.length; i++) {
            // Fix: Strip comments immediately to ensure regex matches clean lines
            const rawLine = lines[i];
            const line = rawLine.split('#')[0].trim();
            const lineNum = i + 1;

            if (!line) continue;

            if (line.includes('--') || line.includes('->')) {
                // Connection Chain
                // Note: parseChain handles splitting internally, but passing clean line is safer
                this.parseChain(line, connections, diagnostics, lineNum);
            } else {
                // Node Definition
                const match = line.match(nodeRegex);
                if (match) {
                    const [_, id, cat, op, x, y, val] = match;
                    nodes.set(id, {
                        id,
                        category: cat,
                        opCode: op,
                        x: x ? parseInt(x) : undefined,
                        y: y ? parseInt(y) : undefined,
                        value: val ? this.parseValue(val) : undefined
                    });
                } else {
                    // Only report error if line wasn't empty (checked above)
                    // If line was just a comment, it became empty and skipped.
                    // If it had content but didn't match regex, report it.
                    diagnostics.push(`Line ${lineNum}: Skipped invalid syntax "${rawLine.trim()}"`);
                }
            }
        }

        const graph = this.convertToInjectable(nodes, connections, diagnostics);
        return { graph, diagnostics };
    }

    private static parseChain(line: string, connections: CGLConnection[], diagnostics: string[], lineNum: number) {
        const cleanLine = line.split('#')[0].trim();
        // Support both -- and -> as separators
        const parts = cleanLine.split(/--|->/).map(p => p.trim());

        for (let i = 0; i < parts.length - 1; i++) {
            const sourceInfo = parts[i];
            const targetInfo = parts[i + 1];

            const sourceParts = sourceInfo.split(':');
            const sourceId = sourceParts[0];
            const sourceHandle = sourceParts[1];

            const targetParts = targetInfo.split(':');
            const targetId = targetParts[0];
            let targetHandle = targetParts[1];

            if (!targetHandle) {
                targetHandle = 'in';
            }

            if (sourceId && targetId) {
                connections.push({
                    sourceId,
                    sourceHandle,
                    targetId,
                    targetHandle
                });
            } else {
                diagnostics.push(`Line ${lineNum}: Invalid connection format "${parts.slice(i, i + 2).join(' -- ')}"`);
            }
        }
    }

    private static parseValue(valStr: string): unknown {
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

        // Try Array/Matrix (e.g. [1, 2, 2])
        if (valStr.trim().startsWith('[') && valStr.trim().endsWith(']')) {
            try {
                // We use JSON.parse for basic array support, but need to ensure it's valid JSON
                // replacing single quotes with double quotes if any, and handling missing quotes for numbers
                // For now, simpler: if it looks like a matrix but JSON.parse fails, return as string
                return JSON.parse(valStr);
            } catch (e) {
                return valStr;
            }
        }

        return valStr;
    }

    // ─── Conversion ──────────────────────────────────────────────────────────

    private static convertToInjectable(cglNodes: Map<string, CGLNode>, cglConns: CGLConnection[], diagnostics: string[]): InjectableGraph {
        const graph: InjectableGraph = { nodes: [], edges: [] };

        // 1. Convert Nodes
        cglNodes.forEach(cNode => {
            const typeInfo = this.resolveType(cNode.category, cNode.opCode);

            if (!typeInfo) {
                diagnostics.push(`Node "${cNode.id}": Unknown category:opcode "${cNode.category}:${cNode.opCode}"`);
                return;
            }

            // Merge default data using OpCode if needed
            const data = { ...((typeInfo.defaultData || {}) as Record<string, unknown>) } as Record<string, unknown>;

            // If value is provided, override appropriate field with strict type validation
            if (cNode.value !== undefined) {
                let validValue = cNode.value;

                // Strict Type Validation
                if (typeInfo.id === 'IO-01' || typeInfo.id === 'IO-02') {
                    if (typeof cNode.value !== 'number') {
                        diagnostics.push(`Node "${cNode.id}": Value "${cNode.value}" is invalid for ${typeInfo.id}. Expected number. Defaulting to 0.`);
                        validValue = 0;
                    }
                } else if (typeInfo.id === 'MA-08' || typeInfo.id === 'MA-09') {
                    if (typeof cNode.value !== 'boolean') {
                        diagnostics.push(`Node "${cNode.id}": Value "${cNode.value}" is invalid for ${typeInfo.id}. Expected boolean. Defaulting to false.`);
                        validValue = false;
                    }
                } else if (typeInfo.id === 'IO-04') {
                    validValue = String(cNode.value);
                }

                // Update cNode.value to the validated value so Brain gets the safe initialValue
                cNode.value = validValue;

                // Map to specific data field based on node type
                if (typeInfo.id === 'IO-01') data.value = validValue;
                else if (typeInfo.id === 'IO-02') data.value = validValue;
                else if (typeInfo.id === 'MA-03') data.val = validValue;
                else if (typeInfo.id === 'MA-08') data.value = validValue;
                else if (typeInfo.id === 'MA-09') data.value = validValue;
                else if (typeInfo.id === 'SY-05') data.code = validValue;
                else if (typeInfo.id === 'IO-08') {
                    // MatrixInputNode expects 2D array [[x, y, z]]. 
                    // If we got 1D [x, y, z] wrap it.
                    let matrixVal = validValue;
                    if (Array.isArray(matrixVal) && matrixVal.length > 0 && !Array.isArray(matrixVal[0])) {
                        matrixVal = [matrixVal];
                    }
                    data.rawExpression = typeof matrixVal === 'string' ? matrixVal : JSON.stringify(matrixVal);
                }
                else if (typeInfo.id.startsWith('IO')) data.value = validValue;
            }

            // Override OpCode if specified (e.g. math:SUB)
            // Even though resolveType might have found the definition, ensuring 'op' is set correctly is safe
            if (cNode.opCode && (typeInfo.category === 'Math' || typeInfo.category === 'LinearAlgebra')) {
                // Standardize OpCode to UpperCase for internal logic
                data.op = cNode.opCode.toUpperCase();

                // Phase 2.15: Fix MA-15 Base Mapping
                if (typeInfo.id === 'MA-15') {
                    data.base = data.op;
                }

                // Phase 2.16: Vector Split Mode Mapping
                if (typeInfo.id === 'AD-09') {
                    if (data.op === 'COMBINE') data.mode = 'combine';
                    if (data.op === 'SEPARATE' || data.op === 'SPLIT') data.mode = 'separate';
                    // Synchronize initial value for mode
                    cNode.value = data.mode;
                }
            }

            // Phase 2.19: Data Family Mapping
            if (cNode.opCode && typeInfo.category === 'Data') {
                const op = cNode.opCode.toLowerCase();
                if (typeInfo.id === 'DA-01') {
                    const opMap: Record<string, string> = { 'mean': 'Mean', 'max': 'Max', 'min': 'Min', 'stddev': 'StdDev', 'median': 'Median', 'variance': 'Variance', 'sum': 'Sum' };
                    if (opMap[op]) data.op = opMap[op];
                } else if (typeInfo.id === 'DA-03') {
                    const opMap: Record<string, string> = { 'sort (asc)': 'Sort (Asc)', 'sort': 'Sort (Asc)', 'sort (desc)': 'Sort (Desc)', 'reverse': 'Reverse', 'unique': 'Unique', 'clean': 'Clean' };
                    if (opMap[op]) data.mode = opMap[op];
                } else if (typeInfo.id === 'DA-04') {
                    const opMap: Record<string, string> = { 'union': 'Union', 'intersection': 'Intersection', 'difference': 'Difference' };
                    if (opMap[op]) data.mode = opMap[op];
                } else if (typeInfo.id === 'DA-05') {
                    const opMap: Record<string, string> = { 'normal': 'Normal', 'uniform': 'Uniform', 'poisson': 'Poisson' };
                    if (opMap[op]) data.mode = opMap[op];
                }
            }

            // Phase 5.1: Calculus Family Mapping
            if (typeInfo.category === 'Calculus') {
                if (cNode.value !== undefined) {
                    // For calculus nodes, value is the expression string
                    data.expression = String(cNode.value);
                }
            }

            // Phase 2.2: Ensure Logic Gate has correct OpCode
            if (cNode.opCode && typeInfo.id === 'MA-05') {
                data.op = cNode.opCode.toUpperCase();
                data.label = data.op;
            }

            graph.nodes.push({
                id: cNode.id,
                type: typeInfo.id,
                position: { x: cNode.x ?? 0, y: cNode.y ?? 0 },
                data: data,
                value: cNode.value // Initial Value for Brain
            });
        });

        // 2. Convert Edges
        cglConns.forEach((conn, idx) => {
            // Determine correct source handle based on Source Node Type
            // Most are 'out', but MA-03 (Constant) uses 'val'.
            let sourceHandle = conn.sourceHandle || 'out';

            // If no explicit sourceHandle, try to intelligently infer it from the definition.
            if (!conn.sourceHandle) {
                const sourceCNode = cglNodes.get(conn.sourceId);
                if (sourceCNode) {
                    const def = this.resolveType(sourceCNode.category, sourceCNode.opCode);
                    if (def && def.handles) {
                        // Phase 2.18: Dynamic Source Inference (Special Case for Vector Split)
                        if (def.id === 'AD-09') {
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
                const sourceCNode = cglNodes.get(conn.sourceId);
                const sourceDef = sourceCNode ? this.resolveType(sourceCNode.category, sourceCNode.opCode) : undefined;
                sourceHandle = this.resolveHandleAlias(conn.sourceHandle, sourceDef?.id, true);
            }

            const targetCNode = cglNodes.get(conn.targetId);
            const targetDef = targetCNode ? this.resolveType(targetCNode.category, targetCNode.opCode) : undefined;
            const resolvedTarget = this.resolveHandleAlias(conn.targetHandle, targetDef?.id, false);

            graph.edges.push({
                id: `e-cgl-${Math.random().toString(36).substr(2, 9)}`,
                source: conn.sourceId,
                sourceHandle: sourceHandle,
                target: conn.targetId,
                targetHandle: resolvedTarget,
                type: 'magnetic',
                data: { pathType: 'bezier', animate: false }
            });

            console.log(`[GraphCodec] Edge ${String(idx)}: ${conn.sourceId}:${sourceHandle} -> ${conn.targetId}:${resolvedTarget}`);
        });

        return graph;
    }

    private static resolveHandleAlias(handle: string, typeId?: string, isSource: boolean = false): string {
        // Skip aliasing for Expert nodes (SY-05, etc.) because handles must match code variables exactly
        if (typeId?.startsWith('SY-')) return handle;

        const h = handle.toLowerCase();

        // 1. Vector Split (AD-09) - RAW HANDLE PASS-THROUGH
        // AD-09 uses x, y, z directly as either source OR target. DO NOT ALIAS THESE.
        if (typeId === 'AD-09') {
            if (['x', 'y', 'z', 'in', 'out'].includes(h)) return h;
        }

        // 2. Common Math Aliases (MA-01 uses in_a, in_b)
        if (!isSource) {
            // Skip a/b aliasing for nodes that use raw a/b (DA Family, Vector Utils etc.)
            if (typeId?.startsWith('DA-') || typeId === 'AD-02') {
                if (['a', 'b', 'data'].includes(h)) return h;
            }

            if (h === 'a') return 'in_a';
            if (h === 'b') return 'in_b';
            if (h === 'base') return 'in_a';
            if (h === 'exp') return 'in_b';

            // 3. Linear Algebra Aliases (x, y, z -> in_x, in_y, in_z) for standard matrix inputs
            if (['x', 'y', 'z'].includes(h)) {
                return `in_${h}`;
            }
        }

        // 4. Logic Aliases
        if (!isSource) {
            if (h === 'cond' || h === 'if' || h === 'sel') return 'condition';
            if (h === 't' || h === 'true') return 'in_true';
            if (h === 'f' || h === 'false') return 'in_false';
        }

        // 5. Source aliases (rare, usually just 'out')
        if (isSource) {
            if (h === 'val' || h === 'ans' || h === 'res') {
                // Common names for output ports in various nodes
                return handle;
            }
        }

        // Fallback
        return handle;
    }

    private static resolveType(category: string, opCode?: string): NodeDefinition | undefined {
        const catLower = category.toLowerCase();
        const opLower = opCode?.toLowerCase();

        // 1. Math Family
        if (catLower === 'math') {
            // Look for matching op in defaultData
            if (opLower) {
                const exactMatch = NODE_DEFINITIONS.find(d =>
                    d.category === 'Math' &&
                    d.defaultData?.op?.toString().toLowerCase() === opLower
                );
                if (exactMatch) return exactMatch;

                // Fallback: If op is specified but not found in definitions, 
                // assume it's a standard Math Node (MA-01) with that op.
                // This allows POW, SQRT, etc. to work without explicit definitions if the engine supports them.
                if (opLower !== 'const' && opLower !== 'round') {
                    const baseMath = NODE_DEFINITIONS.find(d => d.id === 'MA-01');
                    if (baseMath) return baseMath;
                }
            }
            // Fallback for Const, Round if no explicit op match?
            if (opLower === 'const') return NODE_DEFINITIONS.find(d => d.id === 'MA-03');
            if (opLower === 'round') return NODE_DEFINITIONS.find(d => d.id === 'MA-14'); // Fixed from MA-12
            if (opLower === 'base' || opLower === 'hex' || opLower === 'bin') return NODE_DEFINITIONS.find(d => d.id === 'MA-15');
        }

        // 2. IO Family
        if (catLower === 'io' || catLower === 'input' || catLower === 'output' || catLower === 'result') {
            if (opLower === 'num') return NODE_DEFINITIONS.find(d => d.id === 'IO-01');
            if (opLower === 'slider') return NODE_DEFINITIONS.find(d => d.id === 'IO-02');
            if (opLower === 'res') return NODE_DEFINITIONS.find(d => d.id === 'IO-11');
            if (opLower === 'matrix') return NODE_DEFINITIONS.find(d => d.id === 'IO-08');
            if (opLower === 'matrix-res') return NODE_DEFINITIONS.find(d => d.id === 'IO-16');
            if (opLower === 'formula') return NODE_DEFINITIONS.find(d => d.id === 'IO-17');
            if (opLower === 'text') return undefined; // Not implemented
            if (opLower === 'unit') return NODE_DEFINITIONS.find(d => d.id === 'IO-05');
            // Support 'io-08' alias as well just in case
            if (opLower === 'io-08') return NODE_DEFINITIONS.find(d => d.id === 'IO-08');

            // Fallback for IO nodes by ID (e.g. io:IO-11)
            const idMatch = NODE_DEFINITIONS.find(d => d.id.toLowerCase() === opLower);
            if (idMatch) return idMatch;
        }

        // 3. Logic Family
        if (catLower === 'logic') {
            if (opLower === 'and') return NODE_DEFINITIONS.find(d => d.id === 'MA-05');
            if (opLower === 'or') return NODE_DEFINITIONS.find(d => d.id === 'MA-05');
            if (opLower === 'xor') return NODE_DEFINITIONS.find(d => d.id === 'MA-05');
            if (opLower === 'not') return NODE_DEFINITIONS.find(d => d.id === 'MA-05');
            if (opLower === 'gate') return NODE_DEFINITIONS.find(d => d.id === 'MA-05');
            if (opLower === 'split') return NODE_DEFINITIONS.find(d => d.id === 'MA-13');
            if (opLower === 'switch') return NODE_DEFINITIONS.find(d => d.id === 'MA-04');
            if (opLower === 'toggle') return NODE_DEFINITIONS.find(d => d.id === 'MA-08');
            if (opLower === 'button') return NODE_DEFINITIONS.find(d => d.id === 'MA-09');

            // Allow explicit MA-xx codes as opCodes in logic category
            const codeMatch = NODE_DEFINITIONS.find(d => d.id.toLowerCase() === opLower);
            if (codeMatch) return codeMatch;
        }

        // 4. Expert Family
        if (catLower === 'expert') {
            if (opLower === 'sy-05' || opLower === 'expression') return NODE_DEFINITIONS.find(d => d.id === 'SY-05');
            // Fallback for expert nodes by ID
            const idMatch = NODE_DEFINITIONS.find(d => d.id.toLowerCase() === opLower);
            if (idMatch) return idMatch;
        }

        // 5. Emerging Categories (LinearAlgebra, DataStructure, Data)
        if (catLower === 'linearalgebra' || catLower === 'datastructure' || catLower === 'data') {
            if (opLower) {
                // Data family explicit fallbacks
                if (opLower === 'da-01' || ['mean', 'max', 'min', 'stddev', 'median', 'variance', 'sum', 'stats'].includes(opLower)) return NODE_DEFINITIONS.find(d => d.id === 'DA-01');
                if (opLower === 'da-02' || opLower === 'smooth' || opLower === 'smoothing') return NODE_DEFINITIONS.find(d => d.id === 'DA-02');
                if (opLower === 'da-03' || ['unique', 'sort (asc)', 'sort', 'reverse', 'clean', 'list'].includes(opLower)) return NODE_DEFINITIONS.find(d => d.id === 'DA-03');
                if (opLower === 'da-04' || ['union', 'intersection', 'difference', 'set'].includes(opLower)) return NODE_DEFINITIONS.find(d => d.id === 'DA-04');
                if (opLower === 'da-05' || ['normal', 'uniform', 'poisson', 'dist'].includes(opLower)) return NODE_DEFINITIONS.find(d => d.id === 'DA-05');

                const match = NODE_DEFINITIONS.find(d =>
                    d.category.toLowerCase() === catLower &&
                    (d.id.toLowerCase() === opLower || !!d.opTokens?.map(t => t.toLowerCase()).includes(opLower))
                );
                if (match) return match;
            }
        }

        // 6. Calculus Family (Phase 5.1)
        if (catLower === 'calculus') {
            if (opLower === 'derivative' || opLower === 'diff' || opLower === 'ad-04') return NODE_DEFINITIONS.find(d => d.id === 'AD-04');
            if (opLower === 'integral' || opLower === 'integrate' || opLower === 'ad-05') return NODE_DEFINITIONS.find(d => d.id === 'AD-05');
            if (opLower === 'limit' || opLower === 'lim' || opLower === 'ad-11') return NODE_DEFINITIONS.find(d => d.id === 'AD-11');
            if (opLower === 'ode' || opLower === 'odesolver' || opLower === 'sy-04') return NODE_DEFINITIONS.find(d => d.id === 'SY-04');
            // Fallback: try by ID
            const idMatch = NODE_DEFINITIONS.find(d => d.id.toLowerCase() === opLower);
            if (idMatch) return idMatch;
        }

        // 7. Direct ID Match (Fallback)
        // If user types ID-01 explicitly
        return NODE_DEFINITIONS.find(d => d.id.toLowerCase() === category.toLowerCase());
    }

    // ─── Encoding ────────────────────────────────────────────────────────────

    public static encode(graph: InjectableGraph): string {
        let cgl = `# Calctopus Graph Language (Auto-Generated)\n# ${new Date().toISOString()}\n\n`;

        // 1. Nodes
        cgl += '# Nodes\n';
        for (const node of graph.nodes) {
            let cat = 'unknown';
            let op = node.type;
            let val = '';

            const def = NODE_DEFINITIONS.find(d => d.id === node.type);

            if (def) {
                const internalCat = def.category.toLowerCase();
                if (internalCat === 'input' || internalCat === 'output' || internalCat === 'result') {
                    cat = 'io';
                } else if (internalCat === 'logic') {
                    cat = 'logic';
                } else {
                    cat = internalCat;
                }

                // If node has specific parameters, encode them
                if (def.params) {
                    const nodeData = (node.data || {}) as Record<string, unknown>;
                    const paramValues: string[] = [];
                    for (const param of def.params) {
                        if (nodeData[param.id] !== undefined) {
                            paramValues.push(`${param.id}=${String(nodeData[param.id])}`);
                        }
                    }
                    if (paramValues.length > 0) {
                        val = ` {${paramValues.join(', ')}}`;
                    }
                }

                if (cat === 'math') {
                    const nodeData = (node.data || {}) as Record<string, unknown>;
                    if (nodeData.op) {
                        op = String(nodeData.op);
                    } else if (def.defaultData?.op) {
                        op = String(def.defaultData.op);
                    } else if (node.type === 'MA-03') {
                        op = 'CONST';
                        if (nodeData.val !== undefined) val = ` = ${String(nodeData.val)}`;
                    } else if (node.type === 'MA-12') {
                        op = 'ROUND';
                    }
                } else if (cat === 'io') {
                    const nodeData = (node.data || {}) as Record<string, unknown>;
                    if (node.type === 'IO-01') { op = 'num'; if (nodeData.value !== undefined) val = ` = ${String(nodeData.value)}`; }
                    else if (node.type === 'IO-02') { op = 'slider'; if (nodeData.value !== undefined) val = ` = ${String(nodeData.value)}`; }
                    else if (node.type === 'IO-05') { op = 'unit'; }
                    else if (node.type === 'IO-08') { op = 'IO-08'; if (nodeData.rawExpression !== undefined) val = ` = "${String(nodeData.rawExpression).replace(/"/g, '\\"')}"`; }
                } else if (cat === 'logic') {
                    const nodeData = (node.data || {}) as Record<string, unknown>;
                    if (node.type === 'MA-05') { op = String(nodeData.op || 'AND'); }
                    else if (node.type === 'MA-13') { op = 'split'; }
                    else if (node.type === 'MA-04') { op = 'switch'; }
                    else if (node.type === 'MA-08') { op = 'toggle'; if (nodeData.value !== undefined) val = ` = ${String(nodeData.value)}`; }
                    else if (node.type === 'MA-09') { op = 'button'; }
                } else if (internalCat === 'expert') {
                    cat = 'expert';
                    const nodeData = (node.data || {}) as Record<string, unknown>;
                    if (node.type === 'SY-05') {
                        op = 'SY-05';
                        if (nodeData.code !== undefined) val = ` = ${String(nodeData.code)}`;
                    }
                }
            }

            const safeId = node.id.replace(/\s+/g, '_');
            const safeOp = op.toString();

            cgl += `${safeId}:${cat}:${safeOp} @${Math.round(node.position.x)},${Math.round(node.position.y)}${val}\n`;
        }

        // 2. Connections
        cgl += '\n# Connections\n';
        for (const edge of graph.edges) {
            const sourceId = edge.source.replace(/\s+/g, '_');
            const targetId = edge.target.replace(/\s+/g, '_');

            const targetCNode = graph.nodes.find(n => n.id === edge.target);
            let targetHandle = edge.targetHandle || 'in';

            // Phase 2.20: Strict Export Handle Normalization
            // Reverse the alias mapping for common inputs (in_a -> a, in_b -> b)
            if (targetHandle === 'in_a') targetHandle = 'a';
            else if (targetHandle === 'in_b') targetHandle = 'b';
            else if (targetHandle === 'condition') targetHandle = 'cond';
            else if (targetHandle === 'in_true') targetHandle = 't';
            else if (targetHandle === 'in_false') targetHandle = 'f';
            else if (targetHandle.startsWith('in_') && targetHandle.length === 4) {
                // e.g. in_x -> x
                targetHandle = targetHandle.slice(3);
            }

            let sourceHandleStr = '';
            // If the source handle is unconventional (not out, val, result, or int), append it
            // Also check for AD-09 special handles
            const sourceNode = graph.nodes.find(n => n.id === edge.source);
            if (edge.sourceHandle && !['out', 'val', 'result', 'int'].includes(edge.sourceHandle)) {
                // Keep x, y, z for AD-09, otherwise standard 'out' is omitted
                if (sourceNode?.type === 'AD-09' && ['x', 'y', 'z'].includes(edge.sourceHandle)) {
                    sourceHandleStr = `:${edge.sourceHandle}`;
                } else if (!edge.sourceHandle.startsWith('out')) {
                    sourceHandleStr = `:${edge.sourceHandle}`;
                }
            }

            cgl += `${sourceId}${sourceHandleStr} -- ${targetId}:${targetHandle}\n`;
        }

        return cgl;
    }
}
