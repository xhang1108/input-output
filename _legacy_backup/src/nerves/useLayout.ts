import { useCallback } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled';
import { useAppStore } from '@/store/useAppStore';

const elk = new ELK();

// Layout options for a clean "Circuit Board" look
const defaultOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100', // Horizontal spacing
    'elk.spacing.nodeNode': '60', // Vertical spacing
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    // 'elk.edgeRouting': 'ORTHOGONAL', // Optional, React Flow handles bezier, but orthogonal helps Elk calculate
    'elk.portConstraints': 'FIXED_SIDE', // Respect inputs left, outputs right
};

// Accept memories from Body.tsx to share state with the global undo system
export const useLayout = (memories: { remember: () => void }) => {
    const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();

    const layoutGraph = useCallback(async () => {
        const nodes = getNodes();
        const edges = getEdges();

        if (nodes.length === 0) return;

        // Remember state BEFORE layout for Undo
        memories.remember();
        // Logic: remember() saves CURRENT state.

        // Convert React Flow nodes to Elk nodes
        const elkNodes = nodes.map((node) => ({
            id: node.id,
            width: node.measured?.width ?? 150,
            height: node.measured?.height ?? 50,
            // We could add port information here specifically for Elk to know where handles are
            // But 'FIXED_SIDE' with 'RIGHT' direction often assumes Left=Input, Right=Output implicitly for layered.
        }));

        const elkEdges = edges.map((edge) => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
        }));

        try {
            const layoutedGraph = await elk.layout({
                id: 'root',
                layoutOptions: defaultOptions,
                children: elkNodes,
                edges: elkEdges,
            });

            // Map back to React Flow nodes
            const nextNodes = nodes.map((node) => {
                const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
                if (!elkNode) return node;

                return {
                    ...node,
                    position: {
                        x: elkNode.x!,
                        y: elkNode.y!,
                    },
                };
            });

            setNodes(nextNodes);

            // Elk might also route edges if we wanted usage of 'sections', but React Flow usually handles routing via PathFinder.
            // We just update nodes.
            // window.fitView? Maybe.
        } catch (err) {
            console.error('Elk Layout Failed:', err);
        }
    }, [getNodes, getEdges, setNodes, memories]);

    return { layoutGraph };
};
