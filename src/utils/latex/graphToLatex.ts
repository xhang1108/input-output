import { Node, Edge } from '@xyflow/react';
import { FormulaRenderer } from '../FormulaRenderer';
import { ASTNode } from '../../types/payload';

/**
 * Builds an AST (Symbol) from the React Flow graph (nodes and edges).
 * This recursively traverses the graph backwards from the given nodeId.
 */
function buildASTFromGraph(nodeId: string, nodes: Node[], edges: Edge[], visited = new Set<string>()): ASTNode {
    // Cycle detection
    if (visited.has(nodeId)) {
        return { type: 'Identifier', name: 'Cycle' };
    }
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
        return { type: 'Identifier', name: '?' };
    }

    // Helper to get connected input for a specific handle
    const getInputAST = (handleId: string, fallbackValue: number = 0): ASTNode => {
        const incomingEdge = edges.find(e => e.target === nodeId && e.targetHandle === handleId);
        if (incomingEdge) {
            return buildASTFromGraph(incomingEdge.source, nodes, edges, new Set(visited));
        }
        return { type: 'Literal', value: fallbackValue };
    };

    const data = node.data as Record<string, any> || {};
    const type = node.type || '';

    switch (type) {
        // --- Input Family ---
        case 'IN-01': { // Number
            const val = data.value !== undefined ? data.value : 0;
            return data.label
                ? { type: 'Identifier', name: data.label, value: val }
                : { type: 'Literal', value: val };
        }

        case 'IN-02': // Slider
            return { type: 'Literal', value: data.value !== undefined ? data.value : 0 };

        case 'IN-04': // String
            return { type: 'Literal', value: String(data.value || '') };

        case 'IN-07': // Matrix Input
            return data.label ? { type: 'Identifier', name: data.label } : { type: 'Identifier', name: 'Matrix' };

        case 'IN-03': { // Color
            let colorVal = data.value;
            if (colorVal && typeof colorVal === 'object' && colorVal.hex) colorVal = colorVal.hex;
            return { type: 'Literal', value: String(colorVal || '#ffffff') };
        }

        case 'MA-03': // Constant
            return { type: 'Identifier', name: String(data.val || 'pi') };

        // --- Math Family ---
        case 'MA-01': // Standard Math
            const op = data.op || 'ADD';
            const unaryOps = ['SIN', 'COS', 'TAN', 'SQRT', 'ABS'];

            if (unaryOps.includes(op)) {
                return {
                    type: 'FunctionCall',
                    name: op.toLowerCase(),
                    args: [getInputAST('in_a', 0)]
                };
            }
            return {
                type: 'BinaryExpression',
                operator: op,
                left: getInputAST('in_a', 0),
                right: getInputAST('in_b', 0)
            };

        case 'MA-05': // Round
            return { type: 'FunctionCall', name: 'round', args: [getInputAST('in_a', 0), { type: 'Literal', value: data.precision || 0 }] };

        case 'MA-06': // Fraction
            return { type: 'FunctionCall', name: 'fraction', args: [getInputAST('in', 0)] };

        case 'MA-16': // Logarithm
            return {
                type: 'FunctionCall',
                name: (data.op || 'LN').toLowerCase(),
                args: [getInputAST('in', 0), getInputAST('base', Math.E)]
            };

        // --- Calculus / Linear Algebra ---
        case 'CL-01': // Derivative
            return {
                type: 'FunctionCall',
                name: 'diff',
                args: [
                    getInputAST('expr', 0),
                    { type: 'Identifier', name: data.variable || 'x' },
                    { type: 'Literal', value: data.order || 1 }
                ]
            };

        case 'CL-02': // Integral
            return {
                type: 'FunctionCall',
                name: data.mode === 'definite' ? 'defint' : 'integrate',
                args: data.mode === 'definite'
                    ? [
                        getInputAST('expr', 0),
                        { type: 'Literal', value: data.lower || 0 },
                        { type: 'Literal', value: data.upper || 1 },
                        { type: 'Identifier', name: data.variable || 'x' }
                    ]
                    : [
                        getInputAST('expr', 0),
                        { type: 'Identifier', name: data.variable || 'x' }
                    ]
            };

        case 'CL-03': // Limit
            return {
                type: 'FunctionCall',
                name: 'limit',
                args: [
                    getInputAST('expr', 0),
                    { type: 'Identifier', name: data.variable || 'x' },
                    { type: 'Literal', value: data.approach || '0' }
                ]
            };

        // --- Linear Algebra Utils ---
        case 'DT-06': // Matrix Tools
        case 'TR-06': // Stats
            const nodeOp = (data.op || '').toLowerCase();
            return {
                type: 'FunctionCall',
                name: nodeOp,
                args: [getInputAST('in_a', 0), getInputAST('in_b', 0)]
            };

        // --- Output/Pass-through Family ---
        case 'OT-01': // Result
        case 'TR-07': // Color Result
        case 'TR-01': // Unit Assigner
            // For unit assigner, maybe we could prepend a unit? But it expects purely scalar math string for latex mostly.
            return getInputAST('in', 0);

        case 'UT-02': // Reroute
        case 'UI-03': 
            return getInputAST('in', 0);

        // --- Fallback ---
        default:
            const primaryIn = edges.find(e => e.target === nodeId && (e.targetHandle === 'in' || e.targetHandle === 'in_a'));
            if (primaryIn) {
                return buildASTFromGraph(primaryIn.source, nodes, edges, new Set(visited));
            }
            return { type: 'Identifier', name: data.label || `Node(${type})` };
    }
}

/**
 * Converts the output of a specific node into a LaTeX string by 
 * building an AST from the React Flow graph recursively.
 */
export async function exportGraphToLatex(nodeId: string, nodes: Node[], edges: Edge[]): Promise<string> {
    try {
        const ast = buildASTFromGraph(nodeId, nodes, edges);
        return FormulaRenderer.render(ast);
    } catch (e) {
        console.error("Failed to export graph to LaTeX:", e);
        return '\\text{Error}';
    }
}
