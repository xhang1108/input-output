import { useCallback } from 'react';
import { useNodes, useEdges, type Node, type Edge } from '@xyflow/react';
import * as math from 'mathjs';

// Helper to get source node for a specific handle
function getSourceNode(
    nodeId: string,
    handleName: string,
    nodes: Node[],
    edges: Edge[],
    nodeType?: string
) {
    const connectedEdges = edges.filter(e => e.target === nodeId);

    // Logic matches engine.ts parameter mapping
    let targetHandle = handleName;
    if (nodeType === 'unaryNode' || nodeType === 'outputNode' || nodeType === 'solverNode') {
        if (handleName === 'x') targetHandle = 'in';
    }

    // Find specific handle connection or default to first if single input
    const connection = connectedEdges.find(e =>
        e.targetHandle === targetHandle || (connectedEdges.length === 1 && !e.targetHandle)
    );

    if (!connection) return null;
    return nodes.find(n => n.id === connection.source) || null;
}

export function useSpeech() {
    const nodes = useNodes();
    const edges = useEdges();

    const speak = useCallback((startNodeId: string, isSymbolic: boolean): string => {

        function resolveNodeAST(nodeId: string, currentPath: Set<string>): math.MathNode {
            if (currentPath.has(nodeId)) {
                // Cycle detected: Use the node's label to indicate the recursion source
                // This is much friendlier than "CYCLE"
                const node = nodes.find(n => n.id === nodeId);
                const label = node?.data?.label || 'Self';
                return new math.SymbolNode(`↺ ${label}`);
            }

            // Create new path for this branch (recursion stack)
            const nextPath = new Set(currentPath);
            nextPath.add(nodeId);

            const node = nodes.find(n => n.id === nodeId);
            if (!node) return new math.SymbolNode('?');

            // 1. Input Node Leaf
            if (node.type === 'inputNode') {
                if (isSymbolic) {
                    // Use Label
                    return new math.SymbolNode(node.data.label ? `"${node.data.label}"` : `Input_${node.id}`);
                } else {
                    // Use Value (or raw expression if we want to show '7-3' instead of '4'?)
                    // User asked to "replace Symbol with actual result" for numeric mode.
                    const val = node.data.value;
                    const valStr = (val !== undefined && val !== null) ? String(val) : '0';
                    return math.parse(valStr);
                }
            }

            // 2. Intermediate Nodes (Math/Unary)
            // Use the Local AST (e.g., "a + b") and recursively resolve symbols
            const localAST = node.data.ast as math.MathNode;

            // If no local AST, fallback (shouldn't happen for valid nodes)
            if (!localAST) return new math.SymbolNode('?');

            try {
                // Transform local AST symbols into resolved sub-trees
                if (!localAST || typeof localAST.transform !== 'function') {
                    return new math.SymbolNode('?');
                }

                return localAST.transform((child) => {
                    if ((child as any).isSymbolNode) {
                        const symbol = child as math.SymbolNode;
                        const sourceNode = getSourceNode(nodeId, symbol.name, nodes, edges, node.type);

                        if (sourceNode) {
                            const subTree = resolveNodeAST(sourceNode.id, nextPath);

                            // Wrap in parens if it's an operation to preserve precedence
                            // Simple check: if subTree is an OperatorNode, wrap it.
                            // MathJS 'ParenthesisNode' is explicit.
                            if ((subTree as any).isOperatorNode || subTree.type === 'OperatorNode') {
                                return new math.ParenthesisNode(subTree);
                            }
                            return subTree;
                        } else {
                            // Missing input
                            return new math.SymbolNode('?');
                        }
                    }
                    return child;
                });
            } catch (e) {
                console.error("Format error", e);
                return new math.SymbolNode('Error');
            }
        }

        // Start traversal
        // The Output Node itself usually has a local AST of 'x' (or similar) taking input from 'in'
        try {
            const rootNode = nodes.find(n => n.id === startNodeId);
            if (!rootNode) return '';

            // Special case for OutputNode: it typically just passes through its input.
            // If we strictly follow recursion, it will look up input 'x'/'in' and resolve it.
            const resultAST = resolveNodeAST(startNodeId, new Set());

            // Clean up: MathJS puts quotes around symbols if we used strings with spaces.
            // We might want to strip them for display if simple.
            // But toString() is usually good.
            return resultAST.toString();
        } catch (e) {
            return 'Error';
        }

    }, [nodes, edges]);

    return { speak };
}
