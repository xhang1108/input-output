import { useEffect, useState, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Brain, Thoughts, Concept, NeuralConnection } from '../engine/Brain';

// Helper to generate a hash/fingerprint of the graph that only changes
// when calculation-relevant data changes.
// Strictly ignores: position, selected, dragging, width, height, etc.
const sensePatterns = (nodes: Node[], edges: Edge[]) => {
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

export const useBrain = (nodes: Node[], edges: Edge[]) => {
    const [thoughts, setThoughts] = useState<Thoughts>({});
    const previousHash = useRef<string>('');

    useEffect(() => {
        // Debounce: Wait 50ms before checking hash and running engine.
        // This prevents 'sensePatterns' (JSON stringify) from running on every drag frame.
        const handler = setTimeout(() => {
            // 1. Generate Hash
            // console.log('[Brain] 🕵️ Checking patterns...'); // Uncomment to see check frequency
            const currentHash = sensePatterns(nodes, edges);

            // If nothing relevant changed, do nothing.
            if (currentHash === previousHash.current) {
                console.log('[Brain] 💤 Same pattern, skipping calculation.');
                return;
            }

            // Update hash reference
            previousHash.current = currentHash;

            // 3. Prepare Data
            const concepts: Concept[] = nodes.map(n => ({
                id: n.id,
                type: n.type,
                data: n.data,
            }));

            const connections: NeuralConnection[] = edges.map(e => ({
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle
            }));

            // 4. Brain Thinking
            console.time('[Brain] ⚡ Thinking');
            const results = Brain.think(concepts, connections);
            console.timeEnd('[Brain] ⚡ Thinking');

            // 5. Update State
            setThoughts(results);

        }, 50);

        // Cleanup: If user drags/types again within 50ms, cancel the previous timer
        return () => clearTimeout(handler);

    }, [nodes, edges]);

    return { thoughts };
};
