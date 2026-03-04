
import { parseTex } from 'tex-math-parser';
import { generateNodeId } from '@/utils/idGenerator';
import { Transaction } from '@/engine/types';
import { NODE_DEFINITIONS } from '@/definitions/nodeDefinitions';

// Define MathJS AST Types (Simplified)
interface MathNode {
    isNode: boolean;
    type: string;
    mathjs?: string;
    value?: number | string; // ConstantNode
    name?: string; // SymbolNode
    fn?: { name: string } | string; // FunctionNode, OperatorNode can have fn as string
    op?: string; // OperatorNode
    args?: MathNode[]; // OperatorNode, FunctionNode
    content?: MathNode; // ParenthesisNode
}

/**
 * Maps MathJS operators/functions and symbols to Input-Output Operator Strings
 */
const OP_MAP: Record<string, string> = {
    // Functions
    'add': 'ADD',
    'subtract': 'SUB',
    'multiply': 'MUL',
    'divide': 'DIV',
    'pow': 'POW',
    'sqrt': 'SQRT',
    'abs': 'ABS',
    'sin': 'SIN',
    'cos': 'COS',
    'tan': 'TAN',
    'log': 'LOG',
    'ln': 'LN',

    // Symbols
    '+': 'ADD',
    '-': 'SUB',
    '*': 'MUL',
    '/': 'DIV',
    '^': 'POW',
};

/**
 * Parses LaTeX string and generates Input-Output Transactions to build the graph.
 * 
 * @param latex The LaTeX string to parse.
 * @param startPos The position to start placing nodes (approximate).
 * @returns An array of Transactions to apply to the Brain.
 */
export function parseLatexToGraph(latex: string, startPos: { x: number, y: number }): Transaction[] {
    try {
        const rootAst = parseTex(latex);
        const transactions: Transaction[] = [];
        const symbolMap = new Map<string, string>(); // Symbol Name -> Node ID

        // Helper to add node transaction
        const addNodeTransaction = (id: string, type: string, position: { x: number, y: number }, data: any = {}, initialValue?: any) => {
            const definition = NODE_DEFINITIONS.find(def => def.id === type);
            const handles = definition?.handles || [];

            transactions.push({
                type: 'ADD_NODE',
                payload: {
                    id,
                    type,
                    position,
                    data: { ...data, handles },
                    initialValue
                }
            });
        };

        // Recursive traversal
        // Returns the Node ID representing the result of this AST node
        const traverse = (node: MathNode, level: number, offset: number): string => {
            const currentPos = {
                x: startPos.x + (offset * 250),
                y: startPos.y + (level * 150)
            };

            const nodeTypeTag = node.mathjs || node.type;

            if (nodeTypeTag === 'ConstantNode') {
                const id = generateNodeId('IO-01');
                const val = typeof node.value === 'string' ? parseFloat(node.value) : (node.value ?? 0);
                addNodeTransaction(id, 'IO-01', currentPos, { label: String(val), value: val, type: 'scalar' }, val);
                return id;
            }

            if (nodeTypeTag === 'SymbolNode') {
                const name = node.name || 'x';
                // Deduplicate Symbols
                if (symbolMap.has(name)) {
                    return symbolMap.get(name)!;
                }
                const id = generateNodeId('IO-01');
                symbolMap.set(name, id);
                addNodeTransaction(id, 'IO-01', currentPos, { label: name, value: 0, type: 'scalar' }, 0);
                return id;
            }

            if (nodeTypeTag === 'ParenthesisNode' && node.content) {
                return traverse(node.content, level, offset);
            }

            if (nodeTypeTag === 'OperatorNode' || nodeTypeTag === 'FunctionNode') {
                let opName = 'add';
                if (typeof node.fn === 'string') {
                    opName = node.fn;
                } else if (typeof node.fn === 'object' && node.fn.name) {
                    opName = node.fn.name;
                } else if (node.op) { // Fallback for operator nodes that might use 'op'
                    opName = node.op;
                }

                let ioOp = 'ADD';
                switch (opName) {
                    case 'add': ioOp = 'ADD'; break;
                    case 'subtract': ioOp = 'SUB'; break;
                    case 'multiply': ioOp = 'MUL'; break;
                    case 'divide': ioOp = 'DIV'; break;
                    case 'pow': ioOp = 'POW'; break;
                    case 'sin': ioOp = 'SIN'; break;
                    case 'cos': ioOp = 'COS'; break;
                    case 'tan': ioOp = 'TAN'; break;
                    case 'sqrt': ioOp = 'SQRT'; break;
                    case 'abs': ioOp = 'ABS'; break;
                    case 'log': ioOp = 'LOG'; break; // Added log to switch
                    case 'ln': ioOp = 'LN'; break; // Added ln to switch
                    default: ioOp = OP_MAP[opName] || 'ADD'; break; // Fallback to OP_MAP for other cases
                }

                let nodeType = 'MA-01'; // Default Math
                if (ioOp === 'LOG' || ioOp === 'LN') nodeType = 'MA-16';

                const id = generateNodeId(nodeType);
                addNodeTransaction(id, nodeType, currentPos, { op: ioOp, label: ioOp });

                // Process Children
                if (node.args) {
                    (node.args || []).map((arg: any, i: number) => {
                        const sourceId = traverse(arg, level + 1, offset + i);

                        let targetHandle = 'in_a';
                        if (nodeType === 'MA-16') { // LOG, LN
                            targetHandle = i === 0 ? 'in' : 'base';
                        } else if (['ADD', 'SUB', 'MUL', 'DIV', 'POW'].includes(ioOp)) {
                            targetHandle = i === 0 ? 'in_a' : 'in_b';
                        } else {
                            // Unary fallback (SIN, COS, SQRT, ABS etc. using MA-01)
                            targetHandle = 'in_a';
                        }

                        transactions.push({
                            type: 'CONNECT',
                            payload: {
                                id: generateNodeId('EDGE'),
                                source: sourceId,
                                target: id,
                                sourceHandle: 'out',
                                targetHandle: targetHandle
                            }
                        });
                    });
                }
                return id;
            }

            console.warn('Unhandled AST Node:', node);
            return '';
        };

        traverse(rootAst as unknown as MathNode, 0, 0);
        return transactions;

    } catch (e) {
        console.error('LaTeX Parse Error:', e);
        return [];
    }
}

