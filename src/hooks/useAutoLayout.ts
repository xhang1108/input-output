import { useCallback, useEffect, useRef } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import {
    getLayoutedElements,
    mergeLayoutPositions,
    selectLayoutEdges,
    selectLayoutNodes,
    LayoutAlgorithm,
    LayoutDirection
} from './layoutEngine';
import { sortParentFirst } from '../utils/coordinates';
import { useHistoryStore } from '../store/useHistoryStore';
import { Transaction } from '../engine/types/engineTypes';
import { useHistoryExecutor } from './useHistoryExecutor';

export function useAutoLayout(
    setNodes: (nodes: Node[] | ((original: Node[]) => Node[])) => void,
    setEdges: (edges: Edge[] | ((original: Edge[]) => Edge[])) => void,
    layoutAlgorithm: LayoutAlgorithm,
    logAction: (msg: string) => void
) {
    const { fitView, getNodes, getEdges } = useReactFlow();
    const brain = useBrain();
    const pushHistory = useHistoryStore(s => s.push);
    const interactionMode = useHistoryStore(s => s.interactionMode);
    const isRestoring = useHistoryStore(s => s.isRestoring);
    const { undo, redo, canUndo, canRedo } = useHistoryExecutor();

    // 1. Manual Layout Trigger
    const handleAutoLayout = useCallback(async () => {
        // Interaction Collision Lock:
        // Do not layout if user is dragging nodes or scale, or if a restoration is in progress.
        if (interactionMode !== 'IDLE' || isRestoring) {
            console.warn('[AutoLayout] Logic blocked: Interaction in progress');
            return;
        }

        const nodes = getNodes();
        const edges = getEdges();
        const selectedNodes = nodes.filter(n => n.selected);
        const isPartial = selectedNodes.length > 0;

        // Frame policy (docs/frame-integration.md §4-P2, option A):
        // only ROOT, NON-FRAME nodes take part. Frames and everything parented
        // to them (local coordinates) are left exactly where they are, so a
        // layout pass can never split a frame group or write world coordinates
        // into a child's parent-local `position`.
        const nodesToLayout = selectLayoutNodes(nodes, {
            candidateIds: isPartial ? new Set(selectedNodes.map(n => n.id)) : undefined,
        });

        if (nodesToLayout.length === 0) return;

        // Edges are restricted to laid-out endpoints; ELK rejects edges that
        // reference nodes outside its graph (typical for frame children).
        const edgesToLayout = selectLayoutEdges(edges, nodesToLayout);

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
            pushHistory({
                id: `layout_${Date.now()}`,
                description: isPartial ? 'AutoLayout Selection' : 'AutoLayout Global',
                forward,
                inverse
            });

            // Merge by id: only positions change. Frames, children, `parentId`,
            // sizes, `style`, `origin` and `data` are carried over untouched, so
            // no node can be dropped by a global pass.
            if (isPartial) {
                // Functional update: keep anything added while ELK was running.
                setNodes((nds) => mergeLayoutPositions(nds, finalNodes));

                // --- Brain Persistence for Partial Layout ---
                brain.applyTransaction({ type: 'BATCH', payload: forward }, true);

                logAction('Layout Selected (L)');
            } else {
                setNodes(mergeLayoutPositions(nodes, finalNodes));
                // Full edge list: layout only ever sees root-to-root edges, but the
                // UI must keep frame-internal edges.
                setEdges([...edges]);
                
                // --- Brain Persistence (V5 Final) ---
                // We apply the transaction directly to Brain so it's committed 
                // BEFORE any subsequent user interaction/sync.
                brain.applyTransaction({ type: 'BATCH', payload: forward }, true);

                setTimeout(() => fitView({ duration: 800 }), 50); // Global focus
                logAction('Layout Global (L)');
            }
        }
    }, [brain, setNodes, setEdges, layoutAlgorithm, logAction, fitView, interactionMode, isRestoring, pushHistory, getNodes, getEdges]);


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
            const brainEdges = brain.getEdges() as Edge[];
            const uiById = new Map(getNodes().map(node => [node.id, node]));

            // Build the working set from Brain truth, merged BY ID with live UI
            // nodes so UI-only props (origin, style, handles) survive.
            const baseNodes: Node[] = brainNodes.map(brainNode => {
                const uiNode = uiById.get(brainNode.id);
                const brainData = (brainNode.data ?? {}) as Record<string, unknown>;
                const data = { ...(uiNode?.data ?? {}), ...brainData, value: brainNode.value };
                const width = brainNode.width ?? (brainData.width as number | undefined) ?? uiNode?.width;
                const height = brainNode.height ?? (brainData.height as number | undefined) ?? uiNode?.height;

                if (!uiNode) {
                    return {
                        id: brainNode.id,
                        position: brainNode.position ? { ...brainNode.position } : { x: 0, y: 0 },
                        data,
                        type: brainNode.type || 'mathNode',
                        parentId: brainNode.parentId,
                        width,
                        height,
                        selected: brainNode.selected || false,
                    } as Node;
                }

                return {
                    ...uiNode,
                    position: brainNode.position ? { ...brainNode.position } : uiNode.position,
                    data,
                    type: brainNode.type || uiNode.type || 'mathNode',
                    parentId: brainNode.parentId,
                    width,
                    height,
                } as Node;
            });

            // Frame policy: frames and their children are never part of the ELK
            // pass. They keep their own position/size; only root non-frame nodes
            // are re-flowed.
            const nodesToLayout = selectLayoutNodes(baseNodes);
            const edgesToLayout = selectLayoutEdges(brainEdges, nodesToLayout);

            const layouted = nodesToLayout.length > 0
                ? await getLayoutedElements(nodesToLayout, edgesToLayout, {
                    algorithm: layoutAlgorithm,
                    direction: 'RIGHT'
                })
                : { nodes: nodesToLayout, edges: edgesToLayout };

            // --- Brain Persistence for Remote Triggers ---
            // Only laid-out nodes move; frames/children are never written back.
            const forward: Transaction[] = layouted.nodes.map(n => ({
                type: 'MOVE_NODE',
                payload: { id: n.id, position: { ...n.position } }
            }));

            if (forward.length > 0) {
                brain.applyTransaction({ type: 'BATCH', payload: forward }, true);
            }

            // Merge by id instead of replacing the array: every frame node,
            // `parentId`, width/height and child local position is preserved.
            const mergedNodes = sortParentFirst(mergeLayoutPositions(baseNodes, layouted.nodes));

            if (mergedNodes.length > 0) {
                setNodes(mergedNodes);
                // Full edge set (not the filtered layout subset) so frame-internal
                // edges are not dropped from the UI.
                setEdges([...brainEdges]);
            }

            if (forward.length > 0) {
                setTimeout(() => fitView({ duration: 800 }), 50);
                logAction('Layout Triggered via Brain (RE-LAYOUT)');
            }
        });

        return () => {
            cleanupLayout();
        };
    }, [layoutAlgorithm, setNodes, setEdges, logAction, fitView, getNodes]);

    return { handleAutoLayout };
}
