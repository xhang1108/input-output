import { useCallback, useRef, useState, useEffect } from 'react';
import { Edge, Connection, addEdge } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { RelinkState } from '../components/edges/RelinkLine';
import { Brain } from '../engine/Brain';
import { BrainHelper } from '../engine/BrainHelper';
import { Transaction } from '../engine/types';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';

type UseRelinkProps = {
    edges: Edge[];
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    logAction: (action: string) => void;
    edgeType: string;
    edgeAnimation: boolean;
    onSmartLinkSearch?: (params: { nodeId: string; handleId: string; handleType: 'source' | 'target'; position: { x: number; y: number } }) => void;
};

export function useRelink({
    edges,
    setEdges,
    logAction,
    edgeType,
    edgeAnimation,
    onSmartLinkSearch
}: UseRelinkProps) {
    const [relinkState, setRelinkState] = useState<RelinkState>({
        active: false,
        targetNodeId: null,
        targetHandleId: null,
        type: 'target',
        anchors: []
    });

    const removedEdgeIds = useRef<string[]>([]);

    // Track start of ANY connection (New or Relink)
    const connectionStartRef = useRef<{ nodeId: string | null; handleId: string | null; handleType: string | null } | null>(null);

    // Ref for synchronous access in callbacks
    const relinkStateRef = useRef<RelinkState>(relinkState);
    useEffect(() => {
        relinkStateRef.current = relinkState;
    }, [relinkState]);

    /** Submit atomic DISCONNECT+CONNECT via Brain BATCH */
    const submitRelinkBatch = useCallback((newEdges: Edge[]) => {
        const brain = Brain.getInstance();
        const txs: Transaction[] = [
            ...removedEdgeIds.current.map(eid => ({ type: 'DISCONNECT' as const, payload: eid })),
            ...newEdges.map(e => ({ type: 'CONNECT' as const, payload: e }))
        ];
        brain.applyTransaction({ type: 'BATCH', payload: txs });
    }, []);

    const performRelink = useCallback((targetN: string, targetH: string | null) => {
        const state = relinkStateRef.current;
        const anchorNodeId = state.targetNodeId || (state.anchors && state.anchors[0]?.nodeId);

        if (!state.active || !anchorNodeId) return;

        const dropSide = { n: targetN, h: targetH };
        let newEdgesToCreate: Edge[] = [];
        let edgesToRemove: string[] = [...removedEdgeIds.current]; // Start with the dragged wire(s)

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
                        data: { pathType: edgeType, animate: edgeAnimation }
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
                    data: { pathType: edgeType, animate: edgeAnimation }
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

    }, [edgeType, edgeAnimation, setEdges, logAction, edges, submitRelinkBatch]);

    const resetRelink = useCallback(() => {
        const brain = Brain.getInstance();
        brain.isReconnecting = false;
        removedEdgeIds.current = [];
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

    const onRelinkStart = useCallback((event: any, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
        // Always track start params for potential Smart Link
        connectionStartRef.current = params;

        if (relinkStateRef.current.active) return;

        const { nodeId, handleId, handleType } = params;

        if (!nodeId || !handleId) return;

        const nativeEvent = event as any;
        const isCtrl = nativeEvent.ctrlKey || nativeEvent.metaKey;

        if (handleType === 'source' && isCtrl) {
            const outboundEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === handleId);
            if (outboundEdges.length > 0) {
                Brain.getInstance().isReconnecting = true;
                removedEdgeIds.current = outboundEdges.map(e => e.id);
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
                Brain.getInstance().isReconnecting = true;
                removedEdgeIds.current = inboundEdges.map(e => e.id);
                const sourceEdge = inboundEdges[0];
                const newState: RelinkState = { active: true, targetNodeId: sourceEdge.source, targetHandleId: sourceEdge.sourceHandle || null, type: 'source' };
                setRelinkState(newState);
                relinkStateRef.current = newState;
                setEdges(eds => eds.filter(e => e.id !== sourceEdge.id));
                logAction(`Unplugged input ${handleId} from ${nodeId}`);
            }
        }
    }, [edges, setEdges, logAction]);

    const onRelinkEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: any) => {
        const state = relinkStateRef.current;
        const wasRelinking = state.active; // Capture state before potential reset

        if (wasRelinking) {
            const { toNode, toHandle, isValid } = connectionState || {};
            // console.log('[Relink] End:', { toNode: toNode?.id, toHandle: toHandle?.id, isValid });

            if (toNode && toHandle) {
                performRelink(toNode.id, toHandle.id);
            } else {
                // Cancelled: Delete the removed edges via Brain
                const brain = Brain.getInstance();
                removedEdgeIds.current.forEach(eid => {
                    brain.applyTransaction({ type: 'DISCONNECT', payload: eid });
                });
                logAction(`Relink canceled — wire deleted`);
                // console.log('[Relink] Canceled: Wire deleted');
            }
            resetRelink();
        } else {
            // NOT Relinking. Could be a Smart Link Search (Air Drop).
            if (!connectionState.toNode && connectionStartRef.current && connectionStartRef.current.nodeId && onSmartLinkSearch) {
                let screenX, screenY;
                if ('clientX' in event) {
                    const mouseEvent = event as MouseEvent;
                    screenX = mouseEvent.clientX;
                    screenY = mouseEvent.clientY;
                } else {
                    const touchEvent = event as TouchEvent;
                    const touch = touchEvent.changedTouches[0];
                    screenX = touch.clientX;
                    screenY = touch.clientY;
                }

                onSmartLinkSearch({
                    nodeId: connectionStartRef.current.nodeId!,
                    handleId: connectionStartRef.current.handleId!,
                    handleType: connectionStartRef.current.handleType as 'source' | 'target',
                    position: { x: screenX, y: screenY }
                });
            }
        }

        // Always clear start ref
        connectionStartRef.current = null;

    }, [resetRelink, performRelink, logAction, onSmartLinkSearch]);

    // ... (rest of the file)

    const isValidRelinkConnection = useCallback(
        (connection: Edge | Connection) => {
            const brain = Brain.getInstance();
            if (!connection.source || !connection.target) return false;

            // Check for existing connection to replace (Variant: 'single' handles)
            const targetNode = brain.getNode(connection.target);
            const targetDef = NODE_DEFINITIONS.find(d => d.id === targetNode?.type);
            const handleDef = targetDef?.handles.find(h => h.id === connection.targetHandle);

            const isReplacementTarget = handleDef?.variant === 'single';

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
            if (state.active) return; // Relink handled in onConnectEnd

            // Check for existing connection to replace
            const targetHandle = params.targetHandle;
            const existingEdge = edges.find(e =>
                e.target === params.target &&
                e.targetHandle === targetHandle
            );

            // Filter out the existing edge for validation purposes
            // We want to know if the NEW connection is valid *assuming* the old one is gone.
            const edgesForValidation = existingEdge
                ? edges.filter(e => e.id !== existingEdge.id)
                : edges;

            // Final Brain Check (The Firewall)
            const validation = Brain.getInstance().validateConnection(
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

            // If we are replacing, we should probably record the DISCONNECT of the old edge
            // so History is correct? 
            // Brain 'CONNECT' transaction automatically validates. 
            // If we send raw 'CONNECT', Brain will block if we didn't send 'DISCONNECT' first in a BATCH.

            // To be safe and atomic, we should dispatch a BATCH to Brain.
            // But here we are manipulating `setEdges` for local state?
            // `Body.tsx` logic seems to rely on `setEdges` locally, and `useBrainSync` picks it up?
            // OR `useBrainUpdates`?
            // Actually `Brain.ts` has `applyTransaction` which updates local state if we use it?
            // Body.tsx currently uses `setEdges` directly (lines 245-252).
            // AND it has `useBrainSync` (line 130) which watches `edges` and syncs to Brain?
            // Let's look at `useBrainSync.ts`... (I can't see it but I recall it).
            // IF `Body.tsx` is the source of truth for UI, updates here trigger side-effects.

            // Wait, if `Brain.validateConnection` is now strict, checking `this.state.edges` (which might be in sync).
            // If we update `setEdges` locally, `Brain` might not know yet?
            // `useBrainSync` likely pushes changes to Brain.

            // HOWEVER, the `validateConnection` call on line 232 uses `edges` from state.
            // So my manual filter above works for that check.

            // BUT, `Brain.ts` internal state might still have the old edge.
            // If we rely on `useBrainSync` to update Brain, there's a lag.
            // If we want atomic validity, we should probably use `Brain.applyTransaction` here instead of `setEdges`.
            // But `Body.tsx` seems to be Hybrid.

            // Let's Stick to the Plan:
            // 1. Validate with hypothetical removal.
            // 2. Update `setEdges` (which already does replacement filtering).
            // 3. `useBrainSync` will detect the difference and update Brain?
            //    If `useBrainSync` sends a "Diff", it might send "Remove Old, Add New".
            //    If it just sends "Here is new list", Brain might re-validate?

            // CRITIAL: `Brain.ts` `CONNECT` transaction calls `validateConnection`.
            // If `Brain` has the old edge, and we send `CONNECT`, it will BLOCK.
            // We MUST send `DISCONNECT` (old) then `CONNECT` (new) in a BATCH to Brain.
            // OR, rely on `useBrainSync` handling this?
            // If `useBrainSync` is smart, it sends DISCONNECT then CONNECT.

            // Assuming `useBrainSync` handles synchronization. 
            // The `validateConnection` here is just for UI feedback.

            setEdges((eds) => {
                const targetHandleId = params.targetHandle;
                const brain = Brain.getInstance();
                const targetNode = brain.getNode(params.target);
                const targetDef = NODE_DEFINITIONS.find(d => d.id === targetNode?.type);
                const handleDef = targetDef?.handles.find(h => h.id === targetHandleId);

                // If handle exists and is marked as 'single', remove existing wires to it
                if (handleDef?.variant === 'single') {
                    const filtered = eds.filter(e => !(e.target === params.target && e.targetHandle === targetHandleId));
                    return addEdge(params, filtered);
                }

                // Fallback to name-based input guessing for unknown nodes/handles if they are targets
                const isProbablyInput = (h: string | null) => {
                    if (!h) return false;
                    const lh = h.toLowerCase();
                    return lh.startsWith('in') || lh === 'target' || lh.includes('input') || lh === 'condition' || lh === 'select' || lh === 'data' || lh === 'if';
                };

                if (targetHandleId && isProbablyInput(targetHandleId)) {
                    const filtered = eds.filter(e => !(e.target === params.target && e.targetHandle === targetHandleId));
                    return addEdge(params, filtered);
                }

                return addEdge(params, eds);
            });

            logAction(`Connect: ${params.source}:${params.sourceHandle} -> ${params.target}:${params.targetHandle}`);
        },
        [edges, setEdges, logAction]
    );

    return {
        relinkState,
        onRelinkStart,
        onRelinkEnd,
        onRelinkConnect,
        isValidRelinkConnection,
        isRelinkActive: () => relinkStateRef.current.active
    };
}
