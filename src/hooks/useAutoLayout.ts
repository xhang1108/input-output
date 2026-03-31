import { useCallback, useEffect, useRef } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import { getLayoutedElements, LayoutAlgorithm, LayoutDirection } from './layoutEngine';
import { useHistoryStore } from '../store/useHistoryStore';
import { Transaction } from '../engine/types';
import { useHistoryExecutor } from './useHistoryExecutor';

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
    const { push, interactionMode, isRestoring } = useHistoryStore();
    const { undo, redo, canUndo, canRedo } = useHistoryExecutor();

    // 1. Manual Layout Trigger
    const handleAutoLayout = useCallback(async () => {
        // Interaction Collision Lock:
        // Do not layout if user is dragging nodes or scale, or if a restoration is in progress.
        if (interactionMode !== 'IDLE' || isRestoring) {
            console.warn('[AutoLayout] Logic blocked: Interaction in progress');
            return;
        }

        const selectedNodes = nodes.filter(n => n.selected);
        const isPartial = selectedNodes.length > 0;

        let nodesToLayout = isPartial
            ? selectedNodes
            : nodes;

        const edgesToLayout = isPartial
            ? edges.filter(e => selectedNodes.some(n => n.id === e.source) && selectedNodes.some(n => n.id === e.target))
            : edges;

        // Hierarchy Protection
        const layoutIdSet = new Set(nodesToLayout.map(n => n.id));
        nodesToLayout = nodesToLayout.filter(n => !n.parentId || !layoutIdSet.has(n.parentId));

        if (nodesToLayout.length === 0) return;

        // Capture BEFORE Positions
        const oldPositions = new Map<string, { x: number, y: number }>(
            nodesToLayout.map(n => [n.id, { ...n.position }])
        );

        // Calculate Top-Left anchor for partial layout to preserve location (Bounding Box of Red Dots)
        let originalTopLeft = { x: 0, y: 0 };
        if (isPartial) {
            let minX = Infinity, minY = Infinity;
            nodesToLayout.forEach(n => {
                minX = Math.min(minX, n.position.x);
                minY = Math.min(minY, n.position.y);
            });
            originalTopLeft = { x: minX, y: minY };
        }

        const layouted = await getLayoutedElements(nodesToLayout, edgesToLayout, {
            algorithm: layoutAlgorithm,
            direction: 'RIGHT'
        });

        // Restore Top-Left for partial layout
        let finalNodes = layouted.nodes;
        if (isPartial) {
            let minX = Infinity, minY = Infinity;
            layouted.nodes.forEach(n => {
                minX = Math.min(minX, n.position.x);
                minY = Math.min(minY, n.position.y);
            });
            const currentTopLeft = { x: minX, y: minY };

            const offsetX = originalTopLeft.x - currentTopLeft.x;
            const offsetY = originalTopLeft.y - currentTopLeft.y;

            finalNodes = layouted.nodes.map(n => ({
                ...n,
                position: { x: n.position.x + offsetX, y: n.position.y + offsetY }
            }));
        }

        // --- History Generation (Zero-Delta Filter) ---
        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];

        finalNodes.forEach(newNode => {
            const oldPos = oldPositions.get(newNode.id);
            if (oldPos) {
                // Only push if the displacement is significant (> 0.5 flow units)
                const dx = newNode.position.x - oldPos.x;
                const dy = newNode.position.y - oldPos.y;
                if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                    forward.push({ 
                        type: 'MOVE_NODE', 
                        payload: { id: newNode.id, position: { ...newNode.position } } 
                    });
                    inverse.push({ 
                        type: 'MOVE_NODE', 
                        payload: { id: newNode.id, position: { ...oldPos } } 
                    });
                }
            }
        });

        // Trigger UI updates & Push history if changes actually happened
        if (forward.length > 0) {
            push({
                id: `layout_${Date.now()}`,
                description: isPartial ? 'AutoLayout Selection' : 'AutoLayout Global',
                forward,
                inverse
            });

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
        }
    }, [nodes, edges, setNodes, setEdges, layoutAlgorithm, logAction, fitView, interactionMode, isRestoring, push]);


    // --- Interaction & Queuing Logic (v4 Final) ---
    const pendingLayoutRef = useRef(false);
    const isBusyRef = useRef(false);

    // Immediate reactive sync for the ref to avoid Effect latency
    useEffect(() => {
        isBusyRef.current = (interactionMode !== 'IDLE' || isRestoring);
    }, [interactionMode, isRestoring]);

    // Catch-up Effect: Trigger queued layout when returning to IDLE
    useEffect(() => {
        if (interactionMode === 'IDLE' && !isRestoring && pendingLayoutRef.current) {
            pendingLayoutRef.current = false;
            logAction('Executing pending structural layout...');
            // Step into the next frame to ensure Brain state has fully committed from Hand orchestrator
            requestAnimationFrame(() => {
                handleAutoLayout();
            });
        }
    }, [interactionMode, isRestoring, handleAutoLayout, logAction]);

    // 2. Brain Event Listener (RE-LAYOUT)
    useEffect(() => {

        // Listener for automatic layout requests (e.g. after IOGL import)
        const cleanupLayout = brain.on('RE-LAYOUT', async () => {
            // Priority Guard: Check Ref + Direct Store peek for safety
            const currentMode = useHistoryStore.getState().interactionMode;
            if (isBusyRef.current || currentMode !== 'IDLE' || isRestoring) {
                if (!pendingLayoutRef.current) {
                    logAction('Brain Layout queued (Busy)');
                }
                pendingLayoutRef.current = true;
                return;
            }

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

