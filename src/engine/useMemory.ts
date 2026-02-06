import { useEffect, useCallback } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';

const STORAGE_KEY = 'calctopus-flow-storage-v1';

export const initialNodes: Node[] = [
    { id: '1', type: 'baseNode', position: { x: 100, y: 100 }, data: { label: 'Cube' } },
    { id: '2', type: 'baseNode', position: { x: 400, y: 100 }, data: { label: 'Sphere' } },
];

/**
 * useMemory - The hippocampus of the Brain.
 * 
 * Responsibilities:
 * 1. Long-term Potentiation (Persistence): Saving state to localStorage.
 * 2. Recall (Hydration): Restoring state on boot.
 * 3. Tabula Rasa (Reset): Clearing all memories.
 */
export function useMemory(
    nodes: Node[],
    edges: Edge[],
    setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void,
    setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void,
    onLog: (action: string) => void
) {
    const { fitView } = useReactFlow();

    // 1. Recall (Load on Mount)
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const flow = JSON.parse(stored);
                if (flow.nodes && flow.edges) {
                    setNodes(flow.nodes);
                    setEdges(flow.edges);
                    onLog('Memory Recalled');
                }
            } catch (error) {
                console.error('Failed to recall memory:', error);
            }
        }
    }, [setNodes, setEdges, onLog]);

    // 2. Potentiation (Save on Change)
    useEffect(() => {
        if (nodes.length === 0 && edges.length === 0) return; // Don't encode void

        const flow = { nodes, edges };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
        // We don't log every save to avoid noise
    }, [nodes, edges]);

    // 3. Tabula Rasa (Reset)
    const clearMemory = useCallback(() => {
        if (confirm('Are you sure you want to wipe all memory? This cannot be undone.')) {
            localStorage.removeItem(STORAGE_KEY);
            setNodes(initialNodes);
            setEdges([]);
            onLog('Memory Wiped');
            setTimeout(() => fitView({ duration: 400 }), 100);
        }
    }, [setNodes, setEdges, onLog, fitView]);

    return {
        clearMemory
    };
}
