import { useCallback, useRef, useState, useEffect } from 'react';
import { Edge, Connection, addEdge, useStore, ReactFlowState } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { RelinkState } from '../components/edges/RelinkLine';

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

    // React Flow Store to detect hovered handle during drop
    const connectionStatus = useStore((s: ReactFlowState) => s.connection.isValid);
    const hoveredNodeId = useStore((s: ReactFlowState) => s.connection.toNode?.id);
    const hoveredHandleId = useStore((s: ReactFlowState) => s.connection.toHandle?.id);

    // Ref for synchronous access in callbacks
    const relinkStateRef = useRef<RelinkState>(relinkState);
    useEffect(() => {
        relinkStateRef.current = relinkState;
    }, [relinkState]);

    const isReconnecting = useRef(false);

    const performRelink = useCallback((targetN: string, targetH: string | null) => {
        const state = relinkStateRef.current;
        if (!state.active || !state.targetNodeId) return;

        const dropSide = { n: targetN, h: targetH };

        if (state.type === 'target') {
            // Anchor is TargetNode (Input) -> Dragging Source end -> Drop on new Source (Output)
            const anchorsToConnect = state.anchors && state.anchors.length > 0
                ? state.anchors
                : [{ nodeId: state.targetNodeId!, handleId: state.targetHandleId }];

            const newEdges = anchorsToConnect.map(anchor => ({
                id: nanoid(),
                source: dropSide.n!,
                sourceHandle: dropSide.h,
                target: anchor.nodeId,
                targetHandle: anchor.handleId,
                type: 'magnetic' as const,
                data: { pathType: edgeType, animate: edgeAnimation }
            }));

            setEdges((eds) => [...eds, ...(newEdges as any[])]);
            logAction(`Relinked ${newEdges.length} wires (Source Move)`);
        } else {
            // Anchor is SourceNode (Output) -> Dragging Target end -> Drop on new Target (Input)
            const newEdge = {
                id: nanoid(),
                source: state.targetNodeId!,
                sourceHandle: state.targetHandleId ?? null,
                target: dropSide.n!,
                targetHandle: dropSide.h,
                type: 'magnetic' as const,
                data: { pathType: edgeType, animate: edgeAnimation }
            };

            setEdges((eds) => {
                // Ensure atomic replacement for input (standard behavior: one wire per input)
                const filtered = eds.filter(e =>
                    !(e.target === newEdge.target && e.targetHandle === newEdge.targetHandle)
                );
                return addEdge(newEdge as any, filtered);
            });
            logAction('Relinked wire (Target Move)');
        }
    }, [edgeType, edgeAnimation, setEdges, logAction]);

    const resetRelink = useCallback(() => {
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

    const onConnectStart = useCallback((event: any, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
        // Guard: If we are natively reconnecting, IGNORE handle logic
        if (isReconnecting.current) return;

        const { nodeId, handleId, handleType } = params;
        if (!nodeId || !handleId) return;

        const nativeEvent = event as any;
        const isCtrl = nativeEvent.ctrlKey || nativeEvent.metaKey;

        // 1. Output Handle: RELINK UNPLUG (Source -> [Target])
        if (handleType === 'source' && isCtrl) {
            const outboundEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === handleId);
            if (outboundEdges.length > 0) {
                const anchors = outboundEdges.map(e => ({
                    nodeId: e.target,
                    handleId: e.targetHandle || null
                }));

                const newState: RelinkState = {
                    active: true,
                    targetNodeId: anchors[0].nodeId,
                    targetHandleId: anchors[0].handleId,
                    type: 'target',
                    anchors: anchors
                };
                setRelinkState(newState);
                relinkStateRef.current = newState;

                setEdges(eds => eds.filter(e => !outboundEdges.map(oe => oe.id).includes(e.id)));
                logAction(`Unplugged ${outboundEdges.length} outputs`);
            }
        }
        // 2. Input Handle: RELINK UNPLUG (Target -> Source)
        else if (handleType === 'target') {
            const inboundEdges = edges.filter(e => e.target === nodeId && e.targetHandle === handleId);
            if (inboundEdges.length > 0) {
                const sourceEdge = inboundEdges[0];

                const newState: RelinkState = {
                    active: true,
                    targetNodeId: sourceEdge.source,
                    targetHandleId: sourceEdge.sourceHandle || null,
                    type: 'source'
                };
                setRelinkState(newState);
                relinkStateRef.current = newState;

                setEdges(eds => eds.filter(e => e.id !== sourceEdge.id));
                logAction('Unplugged input');
            }
        }
    }, [edges, setEdges, logAction]);

    const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: any) => {
        const state = relinkStateRef.current;
        if (state && state.active) {
            // Use the connectionState provided by React Flow at the moment of drop
            const { toNode, toHandle, isValid } = connectionState || {};

            // During Relink, we trust our own logic if a handle is hovered
            if (toNode && toHandle) {
                performRelink(toNode.id, toHandle.id);
            } else {
                logAction(`Relink aborted (Dropped in void - Valid: ${isValid})`);
            }
            resetRelink();
        }
    }, [resetRelink, performRelink, logAction]);

    const isValidConnection = useCallback(
        (connection: Edge | Connection) => {
            if (connection.source === connection.target) return false;

            const isInput = (id: string | null) => !!id && (id.startsWith('in') || id === 'target');
            const state = relinkStateRef.current;

            if (state.active) {
                // IMPORTANT: During Relink, we are connecting the UNPLUGGED handle to a NEW handle.
                // Both of these are of the SAME type (Input-to-Input or Output-to-Output).
                // So we allow connection only if both handles are of the same type.
                const sIn = isInput(connection.sourceHandle as string | null);
                const tIn = isInput(connection.targetHandle as string | null);
                return sIn === tIn;
            }

            // Normal connection: Must be different types
            return isInput(connection.sourceHandle as string | null) !== isInput(connection.targetHandle as string | null);
        },
        []
    );

    const onConnect = useCallback(
        (params: Connection) => {
            const state = relinkStateRef.current;

            // Relink is now handled exclusively in onConnectEnd to bypass native restrictions
            if (state.active) return;

            // Standard connection
            setEdges((eds) => {
                const targetHandle = params.targetHandle;
                // Simple pattern for input handles to enforce one wire per input
                if (targetHandle && (targetHandle.startsWith('in') || targetHandle === 'target')) {
                    const filtered = eds.filter(e => !(e.target === params.target && e.targetHandle === targetHandle));
                    return addEdge(params, filtered);
                }
                return addEdge(params, eds);
            });

            logAction(`Connect: ${params.source} -> ${params.target}`);
        },
        [setEdges, logAction]
    );

    return {
        relinkState,
        onConnectStart,
        onConnectEnd,
        onConnect,
        isValidConnection
    };
}
