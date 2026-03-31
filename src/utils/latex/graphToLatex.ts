import { Node, Edge } from '@xyflow/react';
import { FormulaRenderer } from '../FormulaRenderer';
import { ASTNode } from '../../types/payload';
import { NODE_DEFINITIONS } from '../../definitions/nodeDefinitions';

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
        case 'MA-02': { // Advanced Math
            const def = NODE_DEFINITIONS.find(d => d.id === node.type);
            const getOrderInput = (handleId: string): ASTNode => {
                const edge = edges.find(e => e.target === nodeId && e.targetHandle === handleId);
                if (!edge) return { type: 'Literal' as const, value: '\\square' };
                return buildASTFromGraph(edge.source, nodes, edges, new Set(visited));
            };

            const op = data.mode || data.op || 'ADD';
            const unaryOps = ['SIN', 'COS', 'TAN', 'SQRT', 'ABS', 'LOG10', 'LN'];

            if (unaryOps.includes(op)) {
                return {
                    type: 'FunctionCall' as const,
                    name: op.toLowerCase(),
                    args: [getOrderInput('in_a')]
                };
            }
            return {
                type: 'BinaryExpression' as const,
                operator: op,
                left: getOrderInput('in_a'),
                right: getOrderInput('in_b')
            };
        }

        case 'MA-05': { // Round
            const getOrderInput = (handleId: string): ASTNode => {
                const edge = edges.find(e => e.target === nodeId && e.targetHandle === handleId);
                if (!edge) return { type: 'Literal' as const, value: '\\square' };
                return buildASTFromGraph(edge.source, nodes, edges, new Set(visited));
            };
            return { 
                type: 'FunctionCall' as const, 
                name: 'round', 
                args: [getOrderInput('in_a'), { type: 'Literal' as const, value: data.precision || 0 }] 
            };
        }

        case 'MA-16': { // Logarithm
            const getOrderInput = (handleId: string): ASTNode => {
                const edge = edges.find(e => e.target === nodeId && e.targetHandle === handleId);
                if (!edge) return { type: 'Literal' as const, value: '\\square' };
                return buildASTFromGraph(edge.source, nodes, edges, new Set(visited));
            };
            
            const valAST = getOrderInput('in_a');
            const mode = data.mode || 'LOGN';

            if (mode === 'LN') return { type: 'FunctionCall' as const, name: 'ln', args: [valAST] };
            if (mode === 'LOG10') return { type: 'FunctionCall' as const, name: 'log', args: [valAST], meta: { base: { type: 'Literal' as const, value: '10' } } };

            const baseEdge = edges.find(e => e.target === nodeId && e.targetHandle === 'in_b');
            const baseAST = baseEdge 
                ? buildASTFromGraph(baseEdge.source, nodes, edges, new Set(visited)) 
                : { type: 'Literal' as const, value: data.base || 10 };

            return { type: 'FunctionCall' as const, name: 'log', args: [valAST], meta: { base: baseAST } };
        }

        // --- Output/Pass-through Family ---
        case 'OT-01': // Result
        case 'TR-07': // Color Result
        case 'TR-01': // Unit Assigner
        case 'UT-02': // Reroute
        case 'UI-03': {
            const primaryIn = edges.find(e => e.target === nodeId && (e.targetHandle === 'in' || e.targetHandle === 'in_a'));
            if (primaryIn) return buildASTFromGraph(primaryIn.source, nodes, edges, new Set(visited));
            return { type: 'Literal' as const, value: '\\square' };
        }

        // --- Fallback ---
        default:
            const firstIn = edges.find(e => e.target === nodeId && (e.targetHandle === 'in' || e.targetHandle === 'in_a'));
            if (firstIn) return buildASTFromGraph(firstIn.source, nodes, edges, new Set(visited));
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
