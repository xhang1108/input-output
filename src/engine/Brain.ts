import { create, all, type BigNumber } from 'mathjs';

// Create a configured instance
const math = create(all);
math.config({
    number: 'BigNumber',
    precision: 64
});

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
        if (type === 'compareNode') {
            const op = data.operation || 'eq';
            switch (op) {
                case 'gt': return math.parse('inputA > inputB');
                case 'lt': return math.parse('inputA < inputB');
                case 'eq': return math.parse('inputA == inputB');
                case 'neq': return math.parse('inputA != inputB');
                case 'gte': return math.parse('inputA >= inputB');
                case 'lte': return math.parse('inputA <= inputB');
                default: return math.parse('inputA == inputB');
            }
        }
        if (type === 'logicNode') {
            const op = data.operation || 'AND';
            switch (op) {
                case 'AND': return math.parse('inputA and inputB'); // MathJS supports 'and'
                case 'OR': return math.parse('inputA or inputB');   // MathJS supports 'or'
                case 'XOR': return math.parse('inputA xor inputB'); // MathJS supports 'xor'
                case 'NAND': return math.parse('not (inputA and inputB)');
                default: return math.parse('inputA and inputB');
            }
        }
    } catch (e) {
        return null;
    }
    return null;
}

// Config is now done at the top level with the instance creation

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

    // Helper: Safely convert anything to BigNumber
    const toBig = (val: any): BigNumber => {
        if (val === undefined || val === null || isNaN(Number(val)) && typeof val !== 'object') return math.bignumber(0);
        try {
            return math.bignumber(val);
        } catch {
            return math.bignumber(0);
        }
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
                        value: toBig(val),
                        ast
                    };
                    break;
                }
                case 'mathNode': {
                    const inputs = getInputs(nodeId);
                    const a = toBig(inputs['inputA']);
                    const b = toBig(inputs['inputB']);
                    const op = node.data.operation || 'add';

                    let val: any = toBig(0);
                    switch (op) {
                        case 'add': val = math.add(a, b); break;
                        case 'sub': val = math.subtract(a, b); break;
                        case 'mul': val = math.multiply(a, b); break;
                        case 'div':
                            // math.divide throws on div by zero usually, or returns Infinity.
                            // Handle if needed, but mathjs handles it predictably.
                            val = math.divide(a, b);
                            break;
                        case 'pow': val = math.pow(a, b); break;
                        case 'mod': val = math.mod(a, b); break;
                        default: val = toBig(0);
                    }
                    thoughts[nodeId] = { value: val, ast };
                    break;
                }
                case 'unaryNode': {
                    const inputs = getInputs(nodeId);
                    const x = toBig(Object.values(inputs)[0]);
                    const op = node.data.operation || 'sqrt';
                    let val: any = toBig(0);

                    // Most math functions in mathjs handle BigNumber automatically if configured
                    switch (op) {
                        case 'sqrt': val = math.sqrt(x); break;
                        case 'sin': val = math.sin(x); break;
                        case 'cos': val = math.cos(x); break;
                        case 'tan': val = math.tan(x); break;
                        case 'abs': val = math.abs(x); break;
                        case 'log': val = math.log(x, math.e); break;
                        case 'round': val = math.round(x); break;
                        default: val = x;
                    }
                    thoughts[nodeId] = { value: val, ast };
                    break;
                }
                case 'outputNode': {
                    const inputs = getInputs(nodeId);
                    const val = toBig(Object.values(inputs)[0]);
                    thoughts[nodeId] = { value: val, ast };
                    break;
                }
                case 'compareNode': {
                    const inputs = getInputs(nodeId);
                    const a = toBig(inputs['inputA']);
                    const b = toBig(inputs['inputB']);
                    const op = node.data.operation || 'eq';
                    const EPSILON = toBig(1e-10); // Still good to have a small epsilon even with BigNumbers if needed? 
                    // Actually BigNumber equality is exact.
                    // But if we generated numbers via distinct paths (like .1 + .2), they should be exact now.
                    // Let's stick to exact comparison for now unless fuzzy is requested for BigNumber.
                    // User asked for "0.1 + 0.2 equals 0.3", BigNumber guarantees this exactness.
                    // So we can use math.compare which returns 1, 0, -1

                    const cmp = math.compare(a, b) as number; // returns 1, 0, -1

                    let result = false;
                    switch (op) {
                        case 'gt': result = cmp > 0; break;
                        case 'lt': result = cmp < 0; break;
                        case 'eq': result = cmp === 0; break;
                        case 'neq': result = cmp !== 0; break;
                        case 'gte': result = cmp >= 0; break;
                        case 'lte': result = cmp <= 0; break;
                        default: result = false;
                    }

                    thoughts[nodeId] = {
                        value: result ? toBig(1) : toBig(0),
                        ast
                    };
                    break;
                }
                case 'logicNode': {
                    const inputs = getInputs(nodeId);
                    const valA = toBig(inputs['inputA']);
                    const valB = toBig(inputs['inputB']);

                    // Logic: Non-zero is True
                    const a = !math.equal(valA, 0);
                    const b = !math.equal(valB, 0);
                    const op = node.data.operation || 'AND';

                    let result = false;
                    switch (op) {
                        case 'AND': result = a && b; break;
                        case 'OR': result = a || b; break;
                        case 'XOR': result = a !== b; break;
                        case 'NAND': result = !(a && b); break;
                        default: result = false;
                    }

                    thoughts[nodeId] = {
                        value: result ? toBig(1) : toBig(0),
                        ast
                    };
                    break;
                }
                default: {
                    thoughts[nodeId] = { value: toBig(node.data.value), ast };
                    break;
                }
            }
        } catch (err) {
            // 🪤 THE TRAP: Catch ephemeral bugs
            const inputs = getInputs(nodeId);
            console.group(`🚨 Brain Freeze: Node [${nodeId}] crashed`);
            console.error('Type:', node.type);
            console.error('Message:', (err as Error).message);
            console.table(inputs); // Show exactly what it ate before dying
            console.error('Raw Data:', node.data);
            console.error('Stack:', (err as Error).stack);
            console.groupEnd();

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
