import * as math from 'mathjs';
import { Transaction, TransactionType } from '../../engine/types';
import { LATEX_REGISTRY, findConfigByLatex } from './latexRegistry';

const generateNodeId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 6)}`;

/**
 * ️ [V4.2.1] MathJS Friendly Pre-processor
 * Strips LaTeX syntax and reformats for standard MathJS expression parsing.
 * Uses space padding to help lexer distinguish operators.
 */
function preProcessForMathJS(latex: string): string {
    let raw = (latex || '').trim();

    // 1. Bracket & Structural Flattening
    raw = raw.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')')
        .replace(/\\left\[/g, '[').replace(/\\right\]/g, ']')
        .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '(($1)/($2))')
        .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)');

    // 2. Heavy Operator Protection
    raw = raw.replace(/\\int\s*([a-z0-9]+)/gi, 'int(($1))')
        .replace(/\\int\s*\((.*?)\)/g, 'int(($1))')
        .replace(/\\nabla\s*([a-z0-9]+)/gi, 'nabla(($1))')
        .replace(/\\nabla\s*\((.*?)\)/g, 'nabla(($1))')
        .replace(/\\geq|>=/g, ' >= ')
        .replace(/\\leq|<=/g, ' <= ')
        .replace(/\\neq/g, ' != ')
        .replace(/\\cdot|\\times/g, ' * ');

    // 3. Final Sweep of remaining commands
    raw = raw.replace(/\\([a-z]+)/gi, ' $1 ') // Add spaces around remaining commands like \pi
        .replace(/\\/g, ''); // Strip remaining backslashes

    // Only convert '=' to '-' if it's NOT part of a logical operator already handled
    if (!raw.includes('>=') && !raw.includes('<=') && !raw.includes('!=')) {
        raw = raw.replace(/=/g, ' - ');
    }

    raw = raw.replace(/d[x-z|t|y]\b/g, ''); // Clear dx, dt symbols

    return raw;
}

export function parseLatexToGraph(latex: string, startPos: { x: number, y: number }): Transaction[] {
    const cleanMath = preProcessForMathJS(latex);

    if (!cleanMath) {
        throw new Error('LaTeX formula is empty.');
    }

    console.log('[LatexToGraph] V4.2.1 Ready String:', cleanMath);

    let rootAst: any;
    try {
        rootAst = math.parse(cleanMath);
    } catch (e: any) {
        console.error('[LatexToGraph] MathJS Parse Failed:', e);
        throw new Error(e.message || String(e));
    }

    const nodeTransactions: Transaction[] = [];
    const edgeTransactions: Transaction[] = [];
    const symbolMap = new Map<string, string>();
    const astIdMap = new WeakMap<any, string>();

    /**
     * Recursive AST Traversal - [V4.2.1 Atomic Continuity]
     */
    function processNode(node: any, depth: number, offset: number): string {
        if (astIdMap.has(node)) return astIdMap.get(node)!;

        const id = generateNodeId('LATEX');
        astIdMap.set(node, id);

        const currentPos = { x: startPos.x + depth * 300, y: startPos.y + offset * 180 };

        // 1. Handle Operators, Functions & Relational comparisons
        if (node.isOperatorNode || node.isFunctionNode || node.isRelationalNode) {
            const opName = node.isOperatorNode ? node.op : (node.isRelationalNode ? node.conditionals[0] : node.name);
            const args = node.isRelationalNode ? node.params : node.args;

            const config = findConfigByLatex(opName || '');
            const nodeType = config?.type || 'MA-01';

            nodeTransactions.push({
                type: 'ADD_NODE',
                payload: {
                    id, type: nodeType, position: currentPos,
                    data: {
                        label: config?.label || opName,
                        op: config?.op || opName,
                        ...(config?.initialData || {})
                    }
                }
            });

            args.forEach((arg: any, idx: number) => {
                const childId = processNode(arg, depth - 1, offset + idx);
                const targetHandle = (config?.handleMapping && config.handleMapping[idx]) || (idx === 0 ? 'in_a' : 'in_b');

                edgeTransactions.push({
                    type: 'CONNECT',
                    payload: { id: `e_${childId}_${id}`, source: childId, target: id, sourceHandle: 'out_a', targetHandle }
                });
            });
            return id;
        }

        // 2. Constant Nodes (Numbers)
        if (node.isConstantNode) {
            nodeTransactions.push({
                type: 'ADD_NODE',
                payload: {
                    id, type: 'IN-01', position: currentPos,
                    data: { label: String(node.value), value: node.value, type: 'scalar' }
                }
            });
            return id;
        }

        // 3. Symbol Nodes (Variables & Multi-char Constants like pi)
        if (node.isSymbolNode) {
            const name = node.name;
            const config = findConfigByLatex(name);
            const isConstant = config?.type === 'IN-06';

            if (!isConstant && symbolMap.has(name)) return symbolMap.get(name)!;
            if (!isConstant) symbolMap.set(name, id);

            nodeTransactions.push({
                type: 'ADD_NODE',
                payload: {
                    id, type: isConstant ? 'IN-06' : 'IN-01',
                    position: currentPos,
                    data: {
                        label: isConstant ? (config?.label || name) : name,
                        op: isConstant ? config?.op : undefined,
                        value: 0, type: 'scalar'
                    }
                }
            });
            return id;
        }

        // 4. Parenthesis (Passthrough)
        if (node.isParenthesisNode) {
            const childId = processNode(node.content, depth, offset);
            astIdMap.set(node, childId);
            return childId;
        }

        return id;
    }

    const rootNodeId = processNode(rootAst, 0, 0);

    // ️ [V1.0] Auto-Attach Result Node
    if (rootNodeId) {
        const resultId = generateNodeId('RESULT');
        nodeTransactions.push({
            type: 'ADD_NODE',
            payload: {
                id: resultId, type: 'OT-01', position: { x: startPos.x + 400, y: startPos.y },
                data: { label: 'Result', mode: 'auto' }
            }
        });
        edgeTransactions.push({
            type: 'CONNECT',
            payload: { id: `e_${rootNodeId}_${resultId}`, source: rootNodeId, target: resultId, sourceHandle: 'out_a', targetHandle: 'in_a' }
        });
    }

    return [...nodeTransactions, ...edgeTransactions];
}
