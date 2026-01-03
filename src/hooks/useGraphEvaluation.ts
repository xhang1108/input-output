import { useEffect, useState, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { evaluateGraph, EvaluationResult, GraphNode } from '../engine/evaluate';

// Helper to generate a hash/fingerprint of the graph that only changes
// when calculation-relevant data changes.
// Strictly ignores: position, selected, dragging, width, height, etc.
const generateGraphHash = (nodes: Node[], edges: Edge[]) => {
    // 1. Nodes Fingerprint: ID + Type + Data Content
    // We sort by ID to ensure order doesn't affect hash if array order shuffles (though usually stable)
    const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
    const nodesHash = sortedNodes.map(n => {
        // Extract only relevant data for calculation
        // Assuming 'value', 'operation', 'rawExpression' are the key drivers
        const { value, operation, rawExpression } = n.data || {};
        return `${n.id}:${n.type}:${JSON.stringify({ value, operation, rawExpression })}`;
    }).join('|');

    // 2. Edges Fingerprint: Source + Target + Handles
    const sortedEdges = [...edges].sort((a, b) => a.id.localeCompare(b.id));
    const edgesHash = sortedEdges.map(e => {
        return `${e.source}:${e.sourceHandle || ''}->${e.target}:${e.targetHandle || ''}`;
    }).join('|');

    return `${nodesHash}::${edgesHash}`;
};

export const useGraphEvaluation = (nodes: Node[], edges: Edge[]) => {
    const [nodeResults, setNodeResults] = useState<EvaluationResult>({});
    const previousHash = useRef<string>('');

    useEffect(() => {
        // 1. Generate Hash immediately to check if we need to schedule a run
        const currentHash = generateGraphHash(nodes, edges);

        // If nothing relevant changed, do nothing.
        if (currentHash === previousHash.current) {
            return;
        }

        // 2. Debounce: Wait 50ms before running the heavy engine
        const handler = setTimeout(() => {
            // Update hash reference
            previousHash.current = currentHash;

            // 3. Prepare Data
            const engineNodes: GraphNode[] = nodes.map(n => ({
                id: n.id,
                type: n.type,
                data: n.data,
            }));

            const engineEdges = edges.map(e => ({
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle
            }));

            // 4. Execute Engine
            // console.time('GraphEvaluation'); // Optional: keep for debugging
            const results = evaluateGraph(engineNodes, engineEdges);
            // console.timeEnd('GraphEvaluation');

            // 5. Update State
            setNodeResults(results);

        }, 50); // <--- 50ms Delay

        // Cleanup: If user types again within 50ms, cancel the previous timer
        return () => clearTimeout(handler);

    }, [nodes, edges]);

    return { nodeResults };
};
