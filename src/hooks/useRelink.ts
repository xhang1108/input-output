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
        const anchorNodeId = state.targetNodeId || (state.anchors && state.anchors[0]?.nodeId);

        if (!state.active || !anchorNodeId) return;

        // 1. ABSOLUTE GUARD: Final edge cannot connect a node to itself
        const isSelfLoop = state.targetNodeId === targetN || state.anchors?.some(a => a.nodeId === targetN);
        if (isSelfLoop) {
            logAction(`Relink blocked: Attempted self-connection on ${targetN}`);
            return;
        }

        const dropSide = { n: targetN, h: targetH };

        if (state.type === 'target') {
            // Anchor is Target (Input) -> Moving the Source end -> Should land on a new Source (Output)
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

            const detail = newEdges.length > 1
                ? `${newEdges.length} wires`
                : `${dropSide.n}:${dropSide.h} -> ${anchorsToConnect[0].nodeId}:${anchorsToConnect[0].handleId}`;
            logAction(`Relinked: ${detail}`);
        } else {
            // Anchor is Source (Output) -> Moving the Target end -> Should land on a new Target (Input)
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
                const filtered = eds.filter(e =>
                    !(e.target === newEdge.target && e.targetHandle === newEdge.targetHandle)
                );
                return addEdge(newEdge as any, filtered);
            });
            logAction(`Relinked: ${newEdge.source}:${newEdge.sourceHandle} -> ${newEdge.target}:${newEdge.targetHandle}`);
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

    const onRelinkStart = useCallback((event: any, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
        if (isReconnecting.current) return;

        const { nodeId, handleId, handleType } = params;
        if (!nodeId || !handleId) return;

        const nativeEvent = event as any;
        const isCtrl = nativeEvent.ctrlKey || nativeEvent.metaKey;

        if (handleType === 'source' && isCtrl) {
            const outboundEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === handleId);
            if (outboundEdges.length > 0) {
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
            if (toNode && toHandle && (isValid || isValid === null)) {
                performRelink(toNode.id, toHandle.id);
            } else {
                logAction(`Relink canceled`);
            }
            resetRelink();
        }
    }, [resetRelink, performRelink, logAction]);

    const isValidRelinkConnection = useCallback(
        (connection: Edge | Connection) => {
            const isInput = (id: string | null) =>
                !!id && (id.toLowerCase().startsWith('in') || id === 'target' || id.includes('input'));

            const state = relinkStateRef.current;

            if (state.active) {
                // 1. Self-Loop Guard: Check if the hovered node is ANY of our anchors
                const isAnchor = (id: string) => state.targetNodeId === id || state.anchors?.some(a => a.nodeId === id);
                if (isAnchor(connection.source) || isAnchor(connection.target)) {
                    return false;
                }

                // 2. Type Mismatch Guard: If both handles are present, they must match types (In-to-In or Out-to-Out)
                // to preserve the Relink intent. Standard RF rule (In-to-Out) is inverted during Relink drag.
                if (connection.sourceHandle && connection.targetHandle) {
                    const sIn = isInput(connection.sourceHandle as string | null);
                    const tIn = isInput(connection.targetHandle as string | null);
                    if (sIn !== tIn) return false;
                }

                return true;
            }

            // Normal Connection: Source (Out) -> Target (In)
            if (connection.source === connection.target) return false;
            return isInput(connection.sourceHandle as string | null) !== isInput(connection.targetHandle as string | null);
        },
        []
    );

    const onRelinkConnect = useCallback(
        (params: Connection) => {
            const state = relinkStateRef.current;
            if (state.active) return; // Relink handled in onConnectEnd

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
        [setEdges, logAction]
    );

    return {
        relinkState,
        onRelinkStart,
        onRelinkEnd,
        onRelinkConnect,
        isValidRelinkConnection
    };
}
