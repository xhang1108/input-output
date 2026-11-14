import { useCallback, useEffect, useRef } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import {
    getLayoutedElements,
    mergeLayoutPositions,
    planPartialLayout,
    selectLayoutEdges,
    selectLayoutNodes,
    LayoutAlgorithm,
    LayoutDirection
} from './layoutEngine';
import { sortParentFirst } from '../utils/coordinates';
import { FRAME_PADDING, getNodeSize } from '../utils/frameGeometry';
import { useHistoryStore } from '../store/useHistoryStore';
import { Transaction } from '../engine/types/engineTypes';

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

        // Layout policy (docs/frame-integration.md §4-P2):
        // - Global: every root, frames included as one sized block, so a frame
        //   group moves as a whole.
        // - Selection with a frame: that frame stays put and its children are
        //   re-arranged inside it (the frame grows if needed).
        // - Selection with children only: those children are laid out in their
        //   own frame's local space.
        // Children are never handed world coordinates.
        const plan = isPartial
            ? planPartialLayout(nodes, new Set(selectedNodes.map(n => n.id)))
            : { worldNodes: selectLayoutNodes(nodes), childGroups: [] };

        if (plan.worldNodes.length === 0 && plan.childGroups.length === 0) return;

        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];
        const movedTo = new Map<string, { x: number; y: number }>();

        const recordMove = (id: string, from: { x: number; y: number }, to: { x: number; y: number }) => {
            movedTo.set(id, to);
            if (Math.abs(to.x - from.x) > 0.5 || Math.abs(to.y - from.y) > 0.5) {
                forward.push({ type: 'MOVE_NODE', payload: { id, position: { ...to } } });
                inverse.push({ type: 'MOVE_NODE', payload: { id, position: { ...from } } });
            }
        };

        // Preserves a group's top-left so a selection-scoped layout refines the
        // arrangement instead of jumping to the origin.
        const restoreTopLeft = (before: Node[], after: Node[]): Node[] => {
            const minOf = (list: Node[]) => list.reduce(
                (acc, n) => ({ x: Math.min(acc.x, n.position.x), y: Math.min(acc.y, n.position.y) }),
                { x: Infinity, y: Infinity }
            );
            const oldMin = minOf(before);
            const newMin = minOf(after);
            if (!Number.isFinite(oldMin.x) || !Number.isFinite(newMin.x)) return after;
            const dx = oldMin.x - newMin.x;
            const dy = oldMin.y - newMin.y;
            return after.map(n => ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }));
        };

        // --- Pass 1: world layout (roots; frames are blocks) ---
        if (plan.worldNodes.length > 0) {
            const worldEdges = selectLayoutEdges(edges, plan.worldNodes);
            const layouted = await getLayoutedElements(plan.worldNodes, worldEdges, {
                algorithm: layoutAlgorithm,
                direction: 'RIGHT'
            });

            const finalNodes = isPartial
                ? restoreTopLeft(plan.worldNodes, layouted.nodes)
                : layouted.nodes;

            const byId = new Map(plan.worldNodes.map(n => [n.id, n]));
            finalNodes.forEach(n => {
                const before = byId.get(n.id);
                if (before) recordMove(n.id, before.position, n.position);
            });
        }

        // --- Pass 2: layout inside each selected frame ---
        const frameResizes = new Map<string, { w: number; h: number }>();
        for (const group of plan.childGroups) {
            const groupEdges = selectLayoutEdges(edges, group.nodes);
            const layouted = await getLayoutedElements(group.nodes, groupEdges, {
                algorithm: layoutAlgorithm,
                direction: 'RIGHT'
            });
            const finalChildren = restoreTopLeft(group.nodes, layouted.nodes);

            const beforeById = new Map(group.nodes.map(n => [n.id, n]));
            finalChildren.forEach(n => {
                const before = beforeById.get(n.id);
                if (before) recordMove(n.id, before.position, n.position);
            });

            // Grow the frame if the new arrangement no longer fits. Expand only:
            // a layout pass never shrinks user-set whitespace.
            const frame = nodes.find(n => n.id === group.frameId);
            if (!frame) continue;
            const frameSize = getNodeSize(frame);
            let maxRight = -Infinity;
            let maxBottom = -Infinity;
            for (const child of nodes.filter(n => n.parentId === group.frameId)) {
                const pos = movedTo.get(child.id) ?? child.position;
                const size = getNodeSize(child);
                maxRight = Math.max(maxRight, pos.x + size.w);
                maxBottom = Math.max(maxBottom, pos.y + size.h);
            }

            const nextW = Math.max(frameSize.w, Math.ceil(maxRight + FRAME_PADDING));
            const nextH = Math.max(frameSize.h, Math.ceil(maxBottom + FRAME_PADDING));
            if (nextW > frameSize.w + 0.5 || nextH > frameSize.h + 0.5) {
                frameResizes.set(frame.id, { w: nextW, h: nextH });
                forward.push({ type: 'RESIZE_NODE', payload: { id: frame.id, width: nextW, height: nextH } });
                inverse.push({ type: 'RESIZE_NODE', payload: { id: frame.id, width: frameSize.w, height: frameSize.h } });
            }
        }

        if (forward.length === 0) return;

        pushHistory({
            id: `layout_${Date.now()}`,
            description: isPartial ? 'AutoLayout Selection' : 'AutoLayout Global',
            forward,
            inverse
        });

        const applyChanges = (list: Node[]) => list.map(n => {
            const position = movedTo.get(n.id);
            const resize = frameResizes.get(n.id);
            if (!position && !resize) return n;
            return {
                ...n,
                ...(position ? { position: { ...position } } : {}),
                ...(resize
                    ? { width: resize.w, height: resize.h, data: { ...n.data, width: resize.w, height: resize.h } }
                    : {}),
            };
        });

        if (isPartial) {
            // Functional update: keep anything added while ELK was running.
            setNodes(nds => applyChanges(nds));
            brain.applyTransaction({ type: 'BATCH', payload: forward }, true);
            logAction('Layout Selected (L)');
        } else {
            setNodes(applyChanges(nodes));
            // Full edge list: layout only sees root-to-root edges, but the UI
            // must keep frame-internal edges.
            setEdges([...edges]);
            brain.applyTransaction({ type: 'BATCH', payload: forward }, true);
            setTimeout(() => fitView({ duration: 800 }), 50);
            logAction('Layout Global (L)');
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

            // Frame policy: roots only, frames included as sized blocks so a
            // frame group moves as a whole. Frame children keep parent-local
            // positions and are never handed world coordinates.
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

            // Merge by id instead of replacing the array: positions may move
            // (frames included), but `parentId`, width/height and child local
            // positions are preserved.
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
