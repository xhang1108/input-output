import * as math from 'mathjs';

export interface GraphNode {
    id: string;
    type?: string;
    data: Record<string, any>;
}

export interface GraphEdge {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

export type EvaluationResult = Record<string, { value: any; error?: string; ast?: any }>;

// Helper to create local AST
function createLocalAST(type: string, data: any): any {
    try {
        if (type === 'inputNode') {
            // For input, the AST is just the symbol or value. 
            // Formatter handles logic, but we can provide base.
            const val = data.value ?? 0;
            return math.parse(String(val));
        }
        if (type === 'mathNode') {
            const op = data.operation || 'add';
            switch (op) {
                case 'add': return math.parse('a + b');
                case 'sub': return math.parse('a - b');
                case 'mul': return math.parse('a * b');
                case 'div': return math.parse('a / b');
                case 'pow': return math.parse('a ^ b');
                case 'mod': return math.parse('a % b');
                default: return math.parse('a + b');
            }
        }
        if (type === 'unaryNode') {
            const op = data.operation || 'sqrt';
            switch (op) {
                case 'sin': return math.parse('sin(x)');
                case 'cos': return math.parse('cos(x)');
                case 'tan': return math.parse('tan(x)');
                case 'sqrt': return math.parse('sqrt(x)');
                case 'abs': return math.parse('abs(x)');
                case 'log': return math.parse('log(x, e)');
                case 'round': return math.parse('round(x)');
                default: return math.parse('x');
            }
        }
        if (type === 'outputNode') {
            return math.parse('x');
        }
    } catch (e) {
        return null; // Fallback
    }
    return null;
}

export function evaluateGraph(nodes: GraphNode[], edges: GraphEdge[]): EvaluationResult {
    // -------------------------------------------------------------------------
    // Step A: Build Graph (Adjacency List & In-Degree)
    // -------------------------------------------------------------------------
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, GraphNode>();

    // Initialize structures for all nodes (including isolated ones)
    for (const node of nodes) {
        adjList.set(node.id, []);
        inDegree.set(node.id, 0);
        nodeMap.set(node.id, node);
    }

    // Populate adjacency list and in-degrees based on edges
    for (const edge of edges) {
        // Only consider edges where both nodes exist
        if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
            continue;
        }

        adjList.get(edge.source)?.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // -------------------------------------------------------------------------
    // Step B: Topological Sort (Kahn's Algorithm)
    // -------------------------------------------------------------------------
    const queue: string[] = [];
    const sortedOrder: string[] = [];

    // Enqueue all nodes with in-degree 0 (start nodes & isolated nodes)
    inDegree.forEach((deg, id) => {
        if (deg === 0) {
            queue.push(id);
        }
    });

    while (queue.length > 0) {
        const u = queue.shift()!;
        sortedOrder.push(u);

        const neighbors = adjList.get(u) || [];
        for (const v of neighbors) {
            inDegree.set(v, (inDegree.get(v) || 0) - 1);
            if (inDegree.get(v) === 0) {
                queue.push(v);
            }
        }
    }

    // Cycle Detection: If sortedOrder length != nodes count, there is a cycle.
    // However, we still want to compute what we can.
    // We will process the sorted nodes. Nodes involved in a cycle won't be in sortedOrder.
    // We mark missing nodes as errors later.

    const results: EvaluationResult = {};

    // Helper to get input value from upstream
    // We need to look at edges to find who feeds into 'targetNode'
    const getInputs = (targetNodeId: string): Record<string, any> => {
        const inputValues: Record<string, any> = {};
        const incomingEdges = edges.filter(e => e.target === targetNodeId);

        for (const edge of incomingEdges) {
            const sourceVal = results[edge.source]?.value;
            // Key by handle id (e.g., 'a', 'b') or generic 'input'
            // If strictly following military spec, we might need robust handle mapping.
            // For now, map by targetHandle if present.
            if (edge.targetHandle) {
                inputValues[edge.targetHandle] = sourceVal;
            }
        }
        return inputValues;
    };

    // -------------------------------------------------------------------------
    // Step C: Execution Loop
    // -------------------------------------------------------------------------
    for (const nodeId of sortedOrder) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;

        try {
            // Generate AST for formatters
            const ast = createLocalAST(node.type || 'default', node.data);

            switch (node.type) {
                case 'inputNode': {
                    // Direct value passthrough
                    const val = node.data.value;
                    results[nodeId] = {
                        value: typeof val === 'string' ? parseFloat(val) : val,
                        ast
                    };
                    break;
                }
                case 'mathNode': {
                    const inputs = getInputs(nodeId);
                    const a = Number(inputs['a'] ?? 0);
                    const b = Number(inputs['b'] ?? 0);
                    const op = node.data.operation || 'add';

                    let val = 0;
                    switch (op) {
                        case 'add': val = a + b; break;
                        case 'sub': val = a - b; break;
                        case 'mul': val = a * b; break;
                        case 'div': val = b !== 0 ? a / b : NaN; break;
                        case 'pow': val = Math.pow(a, b); break;
                        case 'mod': val = a % b; break;
                        default: val = 0;
                    }
                    results[nodeId] = { value: val, ast };
                    break;
                }
                // Placeholder extensions for future types
                case 'unaryNode': {
                    // Example implementation if needed
                    const inputs = getInputs(nodeId);
                    // Assuming 'input' handle or first available
                    const x = Number(Object.values(inputs)[0] ?? 0);
                    const op = node.data.operation || 'sqrt';
                    let val = 0;
                    switch (op) {
                        case 'sqrt': val = Math.sqrt(x); break;
                        case 'sin': val = Math.sin(x); break;
                        case 'cos': val = Math.cos(x); break;
                        default: val = x;
                    }
                    results[nodeId] = { value: val, ast };
                    break;
                }
                case 'outputNode': {
                    const inputs = getInputs(nodeId);
                    const val = Object.values(inputs)[0] ?? 0;
                    results[nodeId] = { value: val, ast };
                    break;
                }
                default: {
                    // Unknown or passthrough
                    results[nodeId] = { value: node.data.value, ast };
                    break;
                }
            }
        } catch (err) {
            results[nodeId] = {
                value: NaN,
                error: (err as Error).message
            };
        }
    }

    // Handle Cycle / Unprocessed Nodes
    const processedSet = new Set(sortedOrder);
    for (const node of nodes) {
        if (!processedSet.has(node.id)) {
            results[node.id] = {
                value: NaN,
                error: 'Cycle detected or dependency missing'
            };
        }
    }

    // -------------------------------------------------------------------------
    // Step D: Return Results
    // -------------------------------------------------------------------------
    return results;
}
