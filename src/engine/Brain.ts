import * as math from 'mathjs';

export interface Concept {
    id: string;
    type?: string;
    data: Record<string, any>;
}

export interface NeuralConnection {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

export type Thoughts = Record<string, { value: any; error?: string; ast?: any }>;

// Helper to create local AST
function createLocalAST(type: string, data: any): any {
    try {
        if (type === 'inputNode') {
            const val = data.value ?? 0;
            return math.parse(String(val));
        }
        if (type === 'mathNode') {
            const op = data.operation || 'add';
            switch (op) {
                case 'add': return math.parse('inputA + inputB');
                case 'sub': return math.parse('inputA - inputB');
                case 'mul': return math.parse('inputA * inputB');
                case 'div': return math.parse('inputA / inputB');
                case 'pow': return math.parse('inputA ^ inputB');
                case 'mod': return math.parse('inputA % inputB');
                default: return math.parse('inputA + inputB');
            }
        }
        if (type === 'unaryNode') {
            const op = data.operation || 'sqrt';
            switch (op) {
                case 'sin': return math.parse('sin(inputA)');
                case 'cos': return math.parse('cos(inputA)');
                case 'tan': return math.parse('tan(inputA)');
                case 'sqrt': return math.parse('sqrt(inputA)');
                case 'abs': return math.parse('abs(inputA)');
                case 'log': return math.parse('log(inputA, e)');
                case 'round': return math.parse('round(inputA)');
                default: return math.parse('inputA');
            }
        }
        if (type === 'outputNode') {
            return math.parse('inputA');
        }
    } catch (e) {
        return null;
    }
    return null;
}

function think(concepts: Concept[], connections: NeuralConnection[]): Thoughts {
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, Concept>();

    for (const node of concepts) {
        adjList.set(node.id, []);
        inDegree.set(node.id, 0);
        nodeMap.set(node.id, node);
    }

    for (const edge of connections) {
        if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
            continue;
        }

        adjList.get(edge.source)?.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    const queue: string[] = [];
    const sortedOrder: string[] = [];

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

    const thoughts: Thoughts = {};

    const getInputs = (targetNodeId: string): Record<string, any> => {
        const inputValues: Record<string, any> = {};
        const incomingEdges = connections.filter(e => e.target === targetNodeId);

        for (const edge of incomingEdges) {
            const sourceVal = thoughts[edge.source]?.value;
            if (edge.targetHandle) {
                inputValues[edge.targetHandle] = sourceVal;
            } else {
                inputValues['default'] = sourceVal;
            }
        }
        return inputValues;
    };

    for (const nodeId of sortedOrder) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;

        try {
            const ast = createLocalAST(node.type || 'default', node.data);

            switch (node.type) {
                case 'inputNode': {
                    const val = node.data.value;
                    thoughts[nodeId] = {
                        value: typeof val === 'string' ? parseFloat(val) : val,
                        ast
                    };
                    break;
                }
                case 'mathNode': {
                    const inputs = getInputs(nodeId);
                    const a = Number(inputs['inputA'] ?? 0);
                    const b = Number(inputs['inputB'] ?? 0);
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
                    thoughts[nodeId] = { value: val, ast };
                    break;
                }
                case 'unaryNode': {
                    const inputs = getInputs(nodeId);
                    const x = Number(Object.values(inputs)[0] ?? 0);
                    const op = node.data.operation || 'sqrt';
                    let val = 0;
                    switch (op) {
                        case 'sqrt': val = Math.sqrt(x); break;
                        case 'sin': val = Math.sin(x); break;
                        case 'cos': val = Math.cos(x); break;
                        case 'tan': val = Math.tan(x); break;
                        case 'abs': val = Math.abs(x); break;
                        case 'log': val = Math.log(x); break;
                        case 'round': val = Math.round(x); break;
                        default: val = x;
                    }
                    thoughts[nodeId] = { value: val, ast };
                    break;
                }
                case 'outputNode': {
                    const inputs = getInputs(nodeId);
                    const val = Object.values(inputs)[0] ?? 0;
                    thoughts[nodeId] = { value: val, ast };
                    break;
                }
                default: {
                    thoughts[nodeId] = { value: node.data.value, ast };
                    break;
                }
            }
        } catch (err) {
            thoughts[nodeId] = {
                value: NaN,
                error: (err as Error).message
            };
        }
    }

    const processedSet = new Set(sortedOrder);
    for (const node of concepts) {
        if (!processedSet.has(node.id)) {
            thoughts[node.id] = {
                value: NaN,
                error: 'Cycle detected or dependency missing'
            };
        }
    }

    return thoughts;
}

export const Brain = {
    think
};
