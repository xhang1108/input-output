import { useCallback, useEffect } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import { getLayoutedElements, LayoutAlgorithm, LayoutDirection } from '../nerves/layoutEngine';

export function useAutoLayout(
    nodes: Node[],
    edges: Edge[],
    setNodes: (nodes: Node[] | ((original: Node[]) => Node[])) => void,
    setEdges: (edges: Edge[] | ((original: Edge[]) => Edge[])) => void,
    layoutAlgorithm: LayoutAlgorithm,
    logAction: (msg: string) => void
) {
    const { fitView } = useReactFlow();
    const brain = useBrain();

    // 1. Manual Layout Trigger
    const handleAutoLayout = useCallback(async () => {
        const selectedNodes = nodes.filter(n => n.selected);
        const isPartial = selectedNodes.length > 0;

        let nodesToLayout = isPartial
            ? selectedNodes
            : nodes;

        const edgesToLayout = isPartial
            ? edges.filter(e => selectedNodes.some(n => n.id === e.source) && selectedNodes.some(n => n.id === e.target))
            : edges;

        // Hierarchy Protection:
        // If a node's parent is also in the layout set, we must exclude the child.
        // ELK would layout them as siblings, but React Flow renders the child relatively.
        // This causes "double movement" and visual detachment.
        const layoutIdSet = new Set(nodesToLayout.map(n => n.id));
        nodesToLayout = nodesToLayout.filter(n => !n.parentId || !layoutIdSet.has(n.parentId));

        if (nodesToLayout.length === 0) return;

        // Calculate center for partial layout to preserve location
        let originalCenter = { x: 0, y: 0 };
        if (isPartial) {
            const xSum = nodesToLayout.reduce((acc, n) => acc + n.position.x, 0);
            const ySum = nodesToLayout.reduce((acc, n) => acc + n.position.y, 0);
            originalCenter = { x: xSum / nodesToLayout.length, y: ySum / nodesToLayout.length };
        }

        const layouted = await getLayoutedElements(nodesToLayout, edgesToLayout, {
            algorithm: layoutAlgorithm,
            direction: 'RIGHT'
        });

        // Restore center for partial layout
        let finalNodes = layouted.nodes;
        if (isPartial) {
            const xSum = layouted.nodes.reduce((acc, n) => acc + n.position.x, 0);
            const ySum = layouted.nodes.reduce((acc, n) => acc + n.position.y, 0);
            const currentCenter = { x: xSum / layouted.nodes.length, y: ySum / layouted.nodes.length };

            const offsetX = originalCenter.x - currentCenter.x;
            const offsetY = originalCenter.y - currentCenter.y;

            finalNodes = layouted.nodes.map(n => ({
                ...n,
                position: { x: n.position.x + offsetX, y: n.position.y + offsetY }
            }));
        }

        if (isPartial) {
            setNodes((nds) => nds.map(n => {
                const found = finalNodes.find(ln => ln.id === n.id);
                return found ? found : n;
            }));
            logAction('Layout Selected (L)');
        } else {
            setNodes([...finalNodes]);
            setEdges([...layouted.edges]);
            setTimeout(() => fitView({ duration: 800 }), 50); // Global focus
            logAction('Layout Global (L)');
        }
    }, [nodes, edges, setNodes, setEdges, layoutAlgorithm, logAction, fitView]);


    // 2. Brain Event Listener (RE-LAYOUT)
    useEffect(() => {

        // Listener for automatic layout requests (e.g. after IOGL import)
        const cleanupLayout = brain.on('RE-LAYOUT', async () => {
            const brainNodes = Array.from(brain.getNodesMap().values());
            const brainEdges = brain.getEdges();

            // Transform logic nodes to React Flow nodes for layout
            const nodesToLayout: Node[] = brainNodes.map(n => ({
                id: n.id,

                position: n.position || { x: 0, y: 0 },
                data: { ...n.data, value: n.value },
                type: n.type || 'mathNode'
            }));

            const layouted = await getLayoutedElements(nodesToLayout, brainEdges as Edge[], {
                algorithm: layoutAlgorithm,
                direction: 'RIGHT'
            });

            setNodes([...layouted.nodes]);
            setEdges([...layouted.edges]);
            setTimeout(() => fitView({ duration: 800 }), 50);
            logAction('Layout Triggered via Brain (RE-LAYOUT)');
        });

        return () => {
            cleanupLayout();
        };
    }, [layoutAlgorithm, setNodes, setEdges, logAction, fitView]);

    return { handleAutoLayout };
}

