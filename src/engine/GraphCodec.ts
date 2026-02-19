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

        // Regex Patterns
        const nodeRegex = /^([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?(?:\s*@(-?\d+),(-?\d+))?(?:\s*=\s*(.*))?$/;

        for (let i = 0; i < lines.length; i++) {
            // Fix: Strip comments immediately to ensure regex matches clean lines
            const rawLine = lines[i];
            const line = rawLine.split('#')[0].trim();
            const lineNum = i + 1;

            if (!line) continue;

            if (line.includes('--')) {
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
        const parts = cleanLine.split('--').map(p => p.trim());

        for (let i = 0; i < parts.length - 1; i++) {
            const sourceInfo = parts[i];
            const targetInfo = parts[i + 1];

            const sourceId = sourceInfo.split(':')[0];

            const targetParts = targetInfo.split(':');
            const targetId = targetParts[0];
            let targetHandle = targetParts[1];

            if (!targetHandle) {
                targetHandle = 'in';
            }

            if (sourceId && targetId) {
                connections.push({
                    sourceId,
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

            // If value is provided, override appropriate field
            if (cNode.value !== undefined) {
                // For Inputs, it's 'value'
                // For Consts, it might be 'val'
                // We need a smart mapper here
                if (typeInfo.id === 'IO-01') data.value = cNode.value;
                else if (typeInfo.id === 'IO-02') data.value = cNode.value;
                else if (typeInfo.id === 'MA-03') data.val = cNode.value;
                else if (typeInfo.id === 'MA-08') data.value = cNode.value; // Fix: Allow Toggle initial value
                else if (typeInfo.id === 'MA-09') data.value = cNode.value; // Fix: Allow Button initial value
                else if (typeInfo.id.startsWith('IO')) data.value = cNode.value; // Generic fallback for IO
            }

            // Override OpCode if specified (e.g. math:SUB)
            // Even though resolveType might have found the definition, ensuring 'op' is set correctly is safe
            if (cNode.opCode && typeInfo.category === 'Math') {
                // Standardize OpCode to UpperCase for internal logic
                data.op = cNode.opCode.toUpperCase();

                // Phase 2.15: Fix MA-15 Base Mapping
                if (typeInfo.id === 'MA-15') {
                    data.base = data.op;
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
            // In CGL, we don't specify source handle yet, so we must infer it.
            let sourceHandle = 'out';

            const sourceCNode = cglNodes.get(conn.sourceId);
            if (sourceCNode) {
                const def = this.resolveType(sourceCNode.category, sourceCNode.opCode);
                if (def && def.handles) {
                    const sourceDef = def.handles.find(h => h.type === 'source');
                    if (sourceDef) {
                        sourceHandle = sourceDef.id;
                    }
                }
            }

            const resolvedTarget = this.resolveHandleAlias(conn.targetHandle);

            graph.edges.push({
                id: `e-cgl-${Math.random().toString(36).substr(2, 9)}`,
                source: conn.sourceId,
                sourceHandle: sourceHandle,
                target: conn.targetId,
                targetHandle: resolvedTarget
            });

            console.log(`[GraphCodec] Edge ${String(idx)}: ${conn.sourceId}:${sourceHandle} -> ${conn.targetId}:${resolvedTarget}`);
        });

        return graph;
    }

    private static resolveHandleAlias(handle: string): string {
        const h = handle.toLowerCase();
        // Common Math Aliases
        if (h === 'a') return 'in_a';
        if (h === 'b') return 'in_b';
        // Base Input Alias
        if (h === 'in') return 'in'; // Explicit 'in' is fine
        if (h === 'base') return 'in_a'; // POW uses 'in_a' (labeled Base), but 'base' is clearer in CGL
        if (h === 'exp') return 'in_b';
        // Logic Aliases
        if (h === 'cond' || h === 'if') return 'condition';
        if (h === 'sel') return 'condition';
        if (h === 't' || h === 'true') return 'in_true';
        if (h === 'f' || h === 'false') return 'in_false';
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
            if (opLower === 'text') return undefined; // Not implemented
            if (opLower === 'unit') return NODE_DEFINITIONS.find(d => d.id === 'IO-05');
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

        // 4. Direct ID Match (Fallback)
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
                } else if (cat === 'logic') {
                    const nodeData = (node.data || {}) as Record<string, unknown>;
                    if (node.type === 'MA-05') { op = String(nodeData.op || 'AND'); }
                    else if (node.type === 'MA-13') { op = 'split'; }
                    else if (node.type === 'MA-04') { op = 'switch'; }
                    else if (node.type === 'MA-08') { op = 'toggle'; if (nodeData.value !== undefined) val = ` = ${String(nodeData.value)}`; }
                    else if (node.type === 'MA-09') { op = 'button'; }
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

            let targetHandle = edge.targetHandle || 'in';
            if (targetHandle === 'in_a') targetHandle = 'a';
            if (targetHandle === 'in_b') targetHandle = 'b';

            cgl += `${sourceId} -- ${targetId}:${targetHandle}\n`;
        }

        return cgl;
    }
}
