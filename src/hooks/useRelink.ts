import { useCallback, useRef, useState, useEffect } from 'react';
import { Edge, Connection, addEdge, OnConnectStartParams, HandleType, useStore } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { RelinkState } from '../components/edges/RelinkLine';
import { capsulePreviewState } from '../components/edges/capsulePreviewState';
import { Brain } from '../engine/Brain';
import { BrainHelper } from '../engine/BrainHelper';
import { Transaction } from '../engine/types';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';
import {
    getHandleVariant,
    findNearestSlot,
    HANDLE_SLOT_SPACING,
    calculateCapsuleHeight
} from '../utils/handleUtils';
import { MagneticSnapState } from './useHandleMagnet';

type UseRelinkProps = {
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    logAction: (action: string) => void;
    edgeType: string;
    onSmartLinkSearch?: (params: { nodeId: string; handleId: string; handleType: 'source' | 'target'; position: { x: number; y: number } }) => void;
};

export function useRelink({
    setEdges,
    logAction,
    edgeType,
    onSmartLinkSearch
}: UseRelinkProps) {
    const edges = useStore((s) => s.edges);
    const [relinkState, setRelinkState] = useState<RelinkState>({
        active: false,
        targetNodeId: null,
        targetHandleId: null,
        type: 'target',
        anchors: []
    });

    const removedEdgeIds = useRef<string[]>([]);
    const removedEdgesBackup = useRef<Edge[]>([]);  // Full edge objects for restore-on-cancel

    // Track mouse position globally so we can read it during onConnect
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        document.addEventListener('mousemove', handler, { passive: true });
        return () => document.removeEventListener('mousemove', handler);
    }, []);

    // Track start of ANY connection (New or Relink)
    const connectionStartRef = useRef<{ nodeId: string | null; handleId: string | null; handleType: string | null } | null>(null);

    // Ref for synchronous access in callbacks
    const relinkStateRef = useRef<RelinkState>(relinkState);
    useEffect(() => {
        relinkStateRef.current = relinkState;
    }, [relinkState]);

    /** Submit atomic DISCONNECT+CONNECT+REORDER via Brain BATCH */
    const submitRelinkBatch = useCallback((newEdges: Edge[]) => {
        const brain = Brain.getInstance();
        const removedIds = removedEdgeIds.current;

        // 1. Calculate the final edge list using the current `edges` from props.
        // This is safe because submitRelinkBatch is an event handler triggered after render.
        let updated = edges.filter(e => !removedIds.includes(e.id));

        for (const newEdge of newEdges) {
            const targetHandleId = newEdge.targetHandle;
            const node = brain.getNode(newEdge.target);
            const variant = getHandleVariant(node, targetHandleId || '');

            if (variant === 'capsule') {
                const preview = capsulePreviewState.getSnapshot();
                const isMatch = preview.active && preview.nodeId === newEdge.target && preview.handleId === targetHandleId;

                const siblingEdges = updated.filter(e =>
                    e.target === newEdge.target && e.targetHandle === targetHandleId && e.id !== newEdge.id
                );
                const totalAfter = siblingEdges.length + 1;

                let insertIndex = siblingEdges.length;

                if (isMatch) {
                    insertIndex = preview.slotIndex;
                } else {
                    const nodeDOM = document.querySelector(`[data-id="${newEdge.target}"]`);
                    const handleDOM = nodeDOM?.querySelector(`[data-handleid="${targetHandleId}"]`);
                    if (handleDOM) {
                        const rect = handleDOM.getBoundingClientRect();
                        const handleCenterY = rect.top + rect.height / 2;
                        insertIndex = findNearestSlot(lastMousePosRef.current.y, handleCenterY, totalAfter);
                    }
                }

                const otherEdges = updated.filter(e =>
                    !(e.target === newEdge.target && e.targetHandle === targetHandleId)
                );
                const orderedSiblings = [...siblingEdges];
                orderedSiblings.splice(insertIndex, 0, newEdge);
                updated = [...otherEdges, ...orderedSiblings];
            } else {
                if (!updated.find(e => e.id === newEdge.id)) {
                    updated.push(newEdge);
                }
            }
        }

        // 2. Apply the ATOMIC BATCH transaction to Brain.
        // This is a side-effect (triggers events/logging). It must be OUTSIDE setEdges.
        brain.applyTransaction({
            type: 'BATCH',
            payload: [
                ...removedIds.map(eid => ({ type: 'DISCONNECT' as const, payload: eid })),
                ...newEdges.map(e => ({ type: 'CONNECT' as const, payload: e })),
                { type: 'REORDER_EDGES' as const, payload: updated.map(e => e.id) }
            ]
        });

        // 3. Update local UI to match.
        setEdges(updated);
    }, [edges, setEdges, edgeType]);

    const performRelink = useCallback((targetN: string, targetH: string | null) => {
        const state = relinkStateRef.current;
        const anchorNodeId = state.targetNodeId || (state.anchors && state.anchors[0]?.nodeId);

        if (!state.active || !anchorNodeId) return;

        const dropSide = { n: targetN, h: targetH };
        let newEdgesToCreate: Edge[] = [];
        const edgesToRemove: string[] = [...removedEdgeIds.current]; // Start with the dragged wire(s)

        if (state.type === 'target') {
            // Anchor is Target (Input). Dragging Source.
            // Usually Inputs don't have existing connections (except the one we are dragging, which is in removedEdgeIds).
            // But we must validate the new Source->Target connection.
            // Note: If we had a Fan-In restriction on Source (Output), we'd check it here.

            const anchorsToConnect = state.anchors && state.anchors.length > 0
                ? state.anchors
                : [{ nodeId: state.targetNodeId!, handleId: state.targetHandleId }];

            newEdgesToCreate = anchorsToConnect
                .map(anchor => {
                    // Proposed: DropSide (Source) -> Anchor (Target)
                    const proposed = { source: dropSide.n!, sourceHandle: dropSide.h, target: anchor.nodeId, targetHandle: anchor.handleId };

                    // Exclude dragged wires from validation to avoid false conflicts
                    // (The wire passed as 'edges' to checkConnectionWithReplacement should NOT include the one we are moving)
                    // We can just filter `edges` right now.

                    const edgesWithoutDragged = edges.filter(e => !removedEdgeIds.current.includes(e.id));

                    const check = BrainHelper.checkConnectionWithReplacement(proposed as Edge, edgesWithoutDragged);

                    if (!check.isValid) {
                        logAction(`Relink Blocked: ${check.reason}`);
                        return null;
                    }

                    // If BrainHelper says we need to replace an edge (on the Anchor Input),
                    // we must add it to the removal list.
                    if (check.edgeToReplace) {
                        edgesToRemove.push(check.edgeToReplace.id);
                    }

                    return {
                        id: nanoid(),
                        source: dropSide.n!,
                        sourceHandle: dropSide.h,
                        target: anchor.nodeId,
                        targetHandle: anchor.handleId,
                        type: 'magnetic' as const,
                        data: { pathType: edgeType }
                    };
                })
                .filter(Boolean) as Edge[];

        } else {
            // Anchor is Source (Output). Dragging Target (Input).
            // DropSide is the NEW Input.

            // Proposed: Anchor (Source) -> DropSide (Target)
            const proposed = {
                source: state.targetNodeId!,
                sourceHandle: state.targetHandleId ?? null,
                target: dropSide.n!,
                targetHandle: dropSide.h
            };

            const edgesWithoutDragged = edges.filter(e => !removedEdgeIds.current.includes(e.id));

            const check = BrainHelper.checkConnectionWithReplacement(proposed as Edge, edgesWithoutDragged);

            if (check.isValid) {
                const newEdge = {
                    id: nanoid(),
                    source: state.targetNodeId!,
                    sourceHandle: state.targetHandleId ?? null,
                    target: dropSide.n!,
                    targetHandle: dropSide.h,
                    type: 'magnetic' as const,
                    data: { pathType: edgeType }
                };
                newEdgesToCreate.push(newEdge);

                if (check.edgeToReplace) {
                    edgesToRemove.push(check.edgeToReplace.id);
                }
            } else {
                logAction(`Relink Blocked: ${check.reason}`);
            }
        }

        if (newEdgesToCreate.length === 0) return;

        // Perform Batch
        // Update removedEdgeIds ref so the submit function works?
        // Actually submitRelinkBatch uses removedEdgeIds.current.
        // We should update it or pass it.
        // Let's modify submitRelinkBatch to accept explicit removals to be cleaner.
        // For now, updating the ref is the minimal change that works with existing architecture.

        // Deduplicate removal IDs
        removedEdgeIds.current = Array.from(new Set(edgesToRemove));

        submitRelinkBatch(newEdgesToCreate);

        const detail = newEdgesToCreate.length > 1
            ? `${newEdgesToCreate.length} wires`
            : `${newEdgesToCreate[0].source}:${newEdgesToCreate[0].sourceHandle} -> ${newEdgesToCreate[0].target}:${newEdgesToCreate[0].targetHandle}`;

        logAction(`Relinked: ${detail}`);

    }, [edgeType, setEdges, logAction, edges, submitRelinkBatch]);

    const resetRelink = useCallback(() => {
        const brain = Brain.getInstance();
        brain.isReconnecting = false;
        removedEdgeIds.current = [];
        removedEdgesBackup.current = [];
        const emptyState: RelinkState = {
            active: false,
            targetNodeId: null,
            targetHandleId: null,
            type: 'target',
            anchors: []
        };
        setRelinkState(emptyState);
        relinkStateRef.current = emptyState;
    }, []);

    const onRelinkStart = useCallback((event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
        // Always track start params for potential Smart Link
        connectionStartRef.current = params;

        if (relinkStateRef.current.active) return;

        const { nodeId, handleId, handleType } = params;

        if (!nodeId || !handleId) return;

        const isCtrl = (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey;
        // const isShift = (event as unknown as React.MouseEvent).shiftKey; // This variable was declared but never used.

        if (handleType === 'source' && isCtrl) {
            const outboundEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === handleId);
            if (outboundEdges.length > 0) {
                Brain.getInstance().isReconnecting = true;
                removedEdgeIds.current = outboundEdges.map(e => e.id);
                removedEdgesBackup.current = [...outboundEdges];
                const anchors = outboundEdges.map(e => ({ nodeId: e.target, handleId: e.targetHandle || null }));
                const newState: RelinkState = { active: true, targetNodeId: anchors[0].nodeId, targetHandleId: anchors[0].handleId, type: 'target', anchors: anchors };
                setRelinkState(newState);
                relinkStateRef.current = newState;
                setEdges(eds => eds.filter(e => !outboundEdges.map(oe => oe.id).includes(e.id)));
                logAction(`Unplugged ${outboundEdges.length} outputs from ${nodeId}`);
            }
        }
        else if (handleType === 'target') {
            const inboundEdges = edges.filter(e => e.target === nodeId && e.targetHandle === handleId);
            if (inboundEdges.length > 0) {
                // Determine if target handle is a capsule variant
                const targetNode = Brain.getInstance().getNode(nodeId);
                const variant = getHandleVariant(targetNode, handleId);

                let edgeToDetach: Edge;

                if (variant === 'capsule' && inboundEdges.length > 1) {
                    // ─── Capsule: Pick the nearest wire based on mouse Y ───
                    // Uses the same ordering as MagneticEdge: edge array index (insertion order)

                    // Get the handle's absolute center Y from the DOM
                    const nodeDOM = document.querySelector(`[data-id="${nodeId}"]`);
                    const handleDOM = nodeDOM?.querySelector(`[data-handleid="${handleId}"]`);
                    let handleCenterY = 0;
                    if (handleDOM) {
                        const rect = handleDOM.getBoundingClientRect();
                        handleCenterY = rect.top + rect.height / 2;
                    }

                    // Get mouse Y from the event
                    let mouseY = 0;
                    if ('clientY' in event) {
                        mouseY = (event as MouseEvent).clientY;
                    } else {
                        const touch = (event as TouchEvent).touches[0];
                        mouseY = touch?.clientY ?? 0;
                    }

                    // Calculate which slot index the mouse is closest to
                    // Using edge insertion order (same as MagneticEdge)
                    const total = inboundEdges.length;
                    const bestIndex = findNearestSlot(mouseY, handleCenterY, total);

                    edgeToDetach = inboundEdges[bestIndex];
                } else {
                    // Single wire or non-capsule: detach the only wire
                    edgeToDetach = inboundEdges[0];
                }

                Brain.getInstance().isReconnecting = true;
                removedEdgeIds.current = [edgeToDetach.id];
                removedEdgesBackup.current = [edgeToDetach];
                const newState: RelinkState = { active: true, targetNodeId: edgeToDetach.source, targetHandleId: edgeToDetach.sourceHandle || null, type: 'source' };
                setRelinkState(newState);
                relinkStateRef.current = newState;
                setEdges(eds => eds.filter(e => e.id !== edgeToDetach.id));
                logAction(`Unplugged wire from ${nodeId}:${handleId}`);
            }
        }
    }, [edges, setEdges, logAction]);

    const isValidRelinkConnection = useCallback(
        (connection: Edge | Connection) => {
            const brain = Brain.getInstance();
            if (!connection.source || !connection.target) return false;

            // Check for existing connection to replace (Variant: 'single' handles)
            const targetNode = brain.getNode(connection.target);
            const variant = getHandleVariant(targetNode, connection.targetHandle || '');

            const isReplacementTarget = variant === 'single'; // Default is single if undefined and not dynamic

            const edgesForValidation = isReplacementTarget
                ? edges.filter(e => !(e.target === connection.target && e.targetHandle === connection.targetHandle))
                : edges;

            const validation = brain.validateConnection(
                connection.source,
                connection.sourceHandle,
                connection.target,
                connection.targetHandle,
                edgesForValidation
            );

            return validation.isValid;
        },
        [edges]
    );

    const onRelinkConnect = useCallback(
        (params: Connection) => {
            const state = relinkStateRef.current;
            if (state.active) return; // Relink handled in onRelinkEnd/performRelink

            // Identify existing connection to replace (for single-variant handles)
            const targetHandle = params.targetHandle;
            const existingEdge = edges.find(e =>
                e.target === params.target &&
                e.targetHandle === targetHandle
            );

            const brain = Brain.getInstance();
            const targetNode = brain.getNode(params.target);
            const variant = getHandleVariant(targetNode, targetHandle || '');

            const isReplacementTarget = variant === 'single';
            const edgesForValidation = (existingEdge && isReplacementTarget)
                ? edges.filter(e => e.id !== existingEdge.id)
                : edges;

            // Validate
            const validation = brain.validateConnection(
                params.source,
                params.sourceHandle,
                params.target,
                params.targetHandle,
                edgesForValidation
            );

            if (!validation.isValid) {
                logAction(`Blocked: ${validation.reason}`);
                return;
            }

            // Create the new edge
            const newEdge: Edge = {
                id: nanoid(),
                source: params.source,
                sourceHandle: params.sourceHandle,
                target: params.target,
                targetHandle: params.targetHandle,
                type: 'magnetic' as const,
                data: { pathType: edgeType }
            };

            // Batch Commit (Remove replaced + Add new + Reorder)
            if (isReplacementTarget && existingEdge) {
                removedEdgeIds.current = [existingEdge.id];
            } else {
                removedEdgeIds.current = [];
            }

            submitRelinkBatch([newEdge]);

            const detail = `${params.source}:${params.sourceHandle} -> ${params.target}:${params.targetHandle}`;
            logAction(`Connected: ${detail}`);
        },
        [edges, edgeType, logAction, submitRelinkBatch]
    );

    const onRelinkEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: { toNode: { id: string } | null; toHandle: { id?: string | null } | null; isValid: boolean | null } | null) => {
        const state = relinkStateRef.current;
        const wasRelinking = state.active; // Capture state before potential reset

        // Evaluate actual target from event (React Flow)
        let { toNode, toHandle, isValid } = connectionState || {};

        if (wasRelinking) {
            // Priority 1: Native Hover Target
            // Priority 2: Magnetic Target (Fallback)
            if (!toNode || !toHandle) {
                if (MagneticSnapState.nodeId && MagneticSnapState.handleId) {
                    toNode = { id: MagneticSnapState.nodeId };
                    toHandle = { id: MagneticSnapState.handleId };
                }
            }

            if (toNode && toHandle) {
                performRelink(toNode.id, toHandle.id || null);
            } else {
                // Cancelled: Delete the removed edges via Brain
                const brain = Brain.getInstance();
                removedEdgeIds.current.forEach(eid => {
                    brain.applyTransaction({ type: 'DISCONNECT', payload: eid });
                });
                logAction(`Relink canceled — wire deleted`);
            }
            resetRelink();
        } else {
            // NOT Relinking. Standard connection or Smart Link search.

            // 1. Check if React Flow Native Connection fired
            const nativeConnectWillFire = isValid === true;

            // 2. Check if we need to synthesized a connection (Magnet Snap but NO native hover)
            const needsSyntheticConnection = !nativeConnectWillFire && MagneticSnapState.nodeId && MagneticSnapState.handleId;

            if (needsSyntheticConnection && connectionStartRef.current?.nodeId) {
                // Synthesize the connection
                const synthesizedConnection: Connection = {
                    source: connectionStartRef.current.nodeId,
                    sourceHandle: connectionStartRef.current.handleId || null,
                    target: MagneticSnapState.nodeId!,
                    targetHandle: MagneticSnapState.handleId! || null,
                };
                onRelinkConnect(synthesizedConnection);

            } else if (!nativeConnectWillFire && !needsSyntheticConnection && connectionStartRef.current?.nodeId && onSmartLinkSearch) {
                // 3. Complete Miss -> Air Drop (Smart Search)
                let screenX, screenY;
                if ('clientX' in event) {
                    const mouseEvent = event as unknown as React.MouseEvent;
                    screenX = mouseEvent.clientX;
                    screenY = mouseEvent.clientY;
                } else {
                    const touchEvent = event as unknown as React.TouchEvent;
                    const touch = touchEvent.changedTouches[0];
                    screenX = touch.clientX;
                    screenY = touch.clientY;
                }

                onSmartLinkSearch({
                    nodeId: connectionStartRef.current.nodeId,
                    handleId: connectionStartRef.current.handleId!,
                    handleType: connectionStartRef.current.handleType as 'source' | 'target',
                    position: { x: screenX, y: screenY }
                });
            }
        }

        // Always clear start ref
        connectionStartRef.current = null;

    }, [resetRelink, performRelink, logAction, onSmartLinkSearch, onRelinkConnect]);

    // ... (rest of the file)


    const startEdgeDragDisconnect = useCallback((event: React.PointerEvent, edgeId: string) => {
        if (relinkStateRef.current.active) return;

        const edge = edges.find(e => e.id === edgeId);
        if (!edge) return;

        Brain.getInstance().isReconnecting = true;
        removedEdgeIds.current = [edge.id];
        removedEdgesBackup.current = [edge];

        const newState: RelinkState = {
            active: true,
            targetNodeId: edge.source,
            targetHandleId: edge.sourceHandle || null,
            type: 'source',
            anchors: []
        };
        setRelinkState(newState);
        relinkStateRef.current = newState;

        setEdges(eds => eds.filter(e => e.id !== edge.id));
        logAction(`Unplugged wire via drag`);
    }, [edges, setEdges, logAction]);

    return {
        relinkState,
        onRelinkStart,
        onRelinkEnd,
        onRelinkConnect,
        isValidRelinkConnection,
        isRelinkActive: () => relinkStateRef.current.active,
        startEdgeDragDisconnect
    };
}
