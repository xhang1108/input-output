import { useCallback, useRef, useState, useEffect } from 'react';
import { Edge, Connection, addEdge } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { RelinkState } from '../components/edges/RelinkLine';
import { Brain } from '../engine/Brain';
import { Transaction } from '../engine/types';

type UseRelinkProps = {
    edges: Edge[];
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    logAction: (action: string) => void;
    edgeType: string;
    edgeAnimation: boolean;
};

export function useRelink({
    edges,
    setEdges,
    logAction,
    edgeType,
    edgeAnimation
}: UseRelinkProps) {
    const [relinkState, setRelinkState] = useState<RelinkState>({
        active: false,
        targetNodeId: null,
        targetHandleId: null,
        type: 'target',
        anchors: []
    });

    const removedEdgeIds = useRef<string[]>([]);

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

        // No manual checks here. We will check in the loop.

        const dropSide = { n: targetN, h: targetH };

        if (state.type === 'target') {
            // Anchor is Target (Input) -> Moving the Source end -> Should land on a new Source (Output)
            const anchorsToConnect = state.anchors && state.anchors.length > 0
                ? state.anchors
                : [{ nodeId: state.targetNodeId!, handleId: state.targetHandleId }];

            // Validate all potential connections individually
            const validNewEdges = anchorsToConnect
                .map(anchor => {
                    // Check against Brain
                    // Anchor is Input (Target of new edge), DropSide is Output (Source of new edge)
                    // Edge: Output(DropSide) -> Input(Anchor)
                    const validation = Brain.getInstance().validateConnection(
                        dropSide.n!,
                        dropSide.h,
                        anchor.nodeId,
                        anchor.handleId,
                        edges
                    );

                    if (!validation.isValid) {
                        logAction(`Relink Blocked: ${validation.reason}`);
                        return null;
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

            if (validNewEdges.length === 0) return;

            submitRelinkBatch(validNewEdges);

            const detail = validNewEdges.length > 1
                ? `${validNewEdges.length} wires`
                : `${dropSide.n}:${dropSide.h} -> ${anchorsToConnect[0].nodeId}:${anchorsToConnect[0].handleId}`;
            logAction(`Relinked: ${detail}`);
        } else {
            // Anchor is Source (Output) -> Moving the Target end -> Should land on a new Target (Input)
            // Edge: Output(Anchor) -> Input(DropSide)

            const validation = Brain.getInstance().validateConnection(
                state.targetNodeId!,
                state.targetHandleId,
                dropSide.n!,
                dropSide.h,
                edges
            );

            if (!validation.isValid) {
                logAction(`Relink Blocked: ${validation.reason}`);
                return;
            }

            const newEdge = {
                id: nanoid(),
                source: state.targetNodeId!,
                sourceHandle: state.targetHandleId ?? null,
                target: dropSide.n!,
                targetHandle: dropSide.h,
                type: 'magnetic' as const,
                data: { pathType: edgeType, animate: edgeAnimation }
            };

            submitRelinkBatch([newEdge]);

            logAction(`Relinked: ${newEdge.source}:${newEdge.sourceHandle} -> ${newEdge.target}:${newEdge.targetHandle}`);
        }
    }, [edgeType, edgeAnimation, setEdges, logAction, edges]);

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
        if (state && state.active) {
            const { toNode, toHandle, isValid } = connectionState || {};
            console.log('[Relink] End:', { toNode: toNode?.id, toHandle: toHandle?.id, isValid });

            if (toNode && toHandle) {
                performRelink(toNode.id, toHandle.id);
            } else {
                // Cancelled: Delete the removed edges via Brain
                const brain = Brain.getInstance();
                removedEdgeIds.current.forEach(eid => {
                    brain.applyTransaction({ type: 'DISCONNECT', payload: eid });
                });
                logAction(`Relink canceled — wire deleted`);
                console.log('[Relink] Canceled: Wire deleted');
            }
            resetRelink();
        }
    }, [resetRelink, performRelink, logAction]);

    const isValidRelinkConnection = useCallback(
        (connection: Edge | Connection) => {
            const validation = Brain.getInstance().validateConnection(
                connection.source!,
                connection.sourceHandle,
                connection.target!,
                connection.targetHandle,
                edges
            );
            return validation.isValid;
        },
        [edges]
    );

    const onRelinkConnect = useCallback(
        (params: Connection) => {
            const state = relinkStateRef.current;
            if (state.active) return; // Relink handled in onConnectEnd

            // Final Brain Check (The Firewall)
            // Even if UI said yes, we double check here before committing to state.
            const validation = Brain.getInstance().validateConnection(
                params.source,
                params.sourceHandle,
                params.target,
                params.targetHandle,
                edges
            );

            if (!validation.isValid) {
                logAction(`Blocked: ${validation.reason}`);
                return;
            }

            setEdges((eds) => {
                const targetHandle = params.targetHandle;
                if (targetHandle && (targetHandle.startsWith('in') || targetHandle === 'target')) {
                    const filtered = eds.filter(e => !(e.target === params.target && e.targetHandle === targetHandle));
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
        isValidRelinkConnection
    };
}
