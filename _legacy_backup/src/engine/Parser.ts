import { Node, Edge } from '@xyflow/react';
import * as math from 'mathjs';
import * as texParser from 'tex-math-parser';
import { nanoid } from 'nanoid';

interface GraphResult {
    nodes: Node[];
    edges: Edge[];
    outputHandle: string;
    rootNodeId: string;
}

/**
 * LaTeX-to-Node Compiler
 * Converts LaTeX strings into a functional Calctopus node graph.
 */
export class LaTeXCompiler {
    private nodes: Node[] = [];
    private edges: Edge[] = [];
    private symbolMap: Map<string, string> = new Map(); // Maps symbol names to Node IDs

    // Normalized mapping for Calctopus internal operation names
    private readonly opMap: Record<string, string> = {
        '+': 'add',
        '-': 'sub',
        '*': 'mul',
        '/': 'div',
        '^': 'pow',
        '%': 'mod',
        'add': 'add',
        'subtract': 'sub',
        'multiply': 'mul',
        'divide': 'div',
        'pow': 'pow'
    };

    constructor() { }

    /**
     * Main entry point: Compiles LaTeX to a set of nodes and edges.
     */
    compile(latex: string, xBase = 0, yBase = 0): { nodes: Node[], edges: Edge[] } {
        this.nodes = [];
        this.edges = [];
        this.symbolMap = new Map();

        try {
            // DEBUG: See what we actually got
            // console.log("texParser keys:", Object.keys(texParser));

            // Adjust for possible default export or named export
            const parseFn = (texParser as any).parseTex || (texParser as any).parse || (texParser as any).default || (typeof texParser === 'function' ? texParser : null);

            if (typeof parseFn !== 'function') {
                throw new Error(`tex-math-parser: parse function not found. Available keys: ${Object.keys(texParser).join(', ')} Type: ${typeof texParser}`);
            }

            const mathjsNode = parseFn(latex);
            this.processNode(mathjsNode, xBase, yBase);
            return { nodes: this.nodes, edges: this.edges };
        } catch (e) {
            console.error("LaTeX Compilation Error:", e);
            return { nodes: [], edges: [] };
        }
    }

    /**
     * Recursive AST Traversal
     */
    private processNode(node: math.MathNode, x: number, y: number): string {
        const id = nanoid(6);
        let nodeType = 'mathNode';
        let data: any = {};

        // 1. Handle Operators (A + B, A * B, etc.)
        if (node.type === 'OperatorNode') {
            const opNode = node as math.OperatorNode;
            nodeType = 'mathNode';

            // Note: opNode.op is the visual token, opNode.fn is the function name (e.g. 'add')
            const opName = this.opMap[opNode.op] || this.opMap[opNode.fn] || opNode.fn || 'add';
            data = { operation: opName };

            // Process children
            if (opNode.args.length === 2) {
                const idA = this.processNode(opNode.args[0], x - 150, y - 50);
                const idB = this.processNode(opNode.args[1], x - 150, y + 50);

                this.addEdge(idA, id, 'output', 'inputA');
                this.addEdge(idB, id, 'output', 'inputB');
            } else if (opNode.args.length === 1) {
                // Unary operators like -x
                const subId = this.processNode(opNode.args[0], x - 150, y);
                this.addEdge(subId, id, 'output', 'inputA');
            }
        }
        // 2. Handle Functions (sin(x), \frac{x}{y} -> divide(x, y))
        else if (node.type === 'FunctionNode') {
            const funcNode = node as any;
            const name = funcNode.name;

            if (this.opMap[name]) {
                nodeType = 'mathNode';
                data = { operation: this.opMap[name] };

                if (funcNode.args.length === 2) {
                    const idA = this.processNode(funcNode.args[0], x - 150, y - 50);
                    const idB = this.processNode(funcNode.args[1], x - 150, y + 50);
                    this.addEdge(idA, id, 'output', 'inputA');
                    this.addEdge(idB, id, 'output', 'inputB');
                } else {
                    const subId = this.processNode(funcNode.args[0], x - 150, y);
                    this.addEdge(subId, id, 'output', 'inputA');
                }
            } else {
                nodeType = 'unaryNode';
                data = { operation: name };

                if (funcNode.args.length > 0) {
                    const subId = this.processNode(funcNode.args[0], x - 150, y);
                    this.addEdge(subId, id, 'output', 'inputA');
                }
            }
        }
        // 3. Handle Symbols (x, y, alpha)
        else if (node.type === 'SymbolNode') {
            const symNode = node as math.SymbolNode;

            // Deduplicate symbols to same node
            if (this.symbolMap.has(symNode.name)) {
                return this.symbolMap.get(symNode.name)!;
            }

            nodeType = 'inputNode';
            data = { symbol: symNode.name, value: 0 };
            this.symbolMap.set(symNode.name, id);
        }
        // 4. Handle Constants (5, 3.14)
        else if (node.type === 'ConstantNode') {
            const constNode = node as math.ConstantNode;
            nodeType = 'inputNumberNode';
            data = { value: constNode.value, label: String(constNode.value) };
        }
        // 5. Parenthesis (Passthrough)
        else if (node.type === 'ParenthesisNode') {
            const parenNode = node as math.ParenthesisNode;
            return this.processNode(parenNode.content, x, y);
        }

        // Add to our collection
        this.nodes.push({
            id,
            type: nodeType,
            position: { x, y },
            data
        });

        return id;
    }

    private addEdge(source: string, target: string, sourceHandle: string, targetHandle: string) {
        this.edges.push({
            id: `e_${source}_${target}`,
            source,
            target,
            sourceHandle,
            targetHandle,
            type: 'custom'
        });
    }
}

export const compileLaTeX = (latex: string, x = 0, y = 0) => {
    return new LaTeXCompiler().compile(latex, x, y);
};
