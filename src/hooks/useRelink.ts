import { useCallback, useRef, useState, useEffect } from 'react';
import { Edge, Connection, OnConnectStartParams, useStore } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { RelinkState } from '../components/edges/RelinkLine';
import { capsulePreviewState } from '../components/edges/capsulePreviewState';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import { BrainHelper } from '../engine/BrainHelper';
import {
    getHandleVariant,
    findNearestSlot,
    getHandleColorByConfig
} from '../utils/handleUtils';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';
import { MagneticSnapState } from './useHandleMagnet';
import { useHistoryStore } from '../store/useHistoryStore';
import { Transaction } from '../engine/types';

type UseRelinkProps = {
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    logAction: (action: string) => void;
    edgeType: string;
    onSmartLinkSearch?: (params: { nodeId: string; handleId: string; handleType: 'source' | 'target'; handleColor: string; position: { x: number; y: number } }) => void;
};

export function useRelink({
    setEdges,
    logAction,
    edgeType,
    onSmartLinkSearch
}: UseRelinkProps) {
    const brain = useBrain();
    const pushHistory = useHistoryStore(s => s.push);
    const edges = useStore((s) => s.edges);
    const [relinkState, setRelinkState] = useState<RelinkState>({
        active: false,
        targetNodeId: null,
        targetHandleId: null,
        type: 'target',
        anchors: []
    });

    const removedEdgeIds = useRef<string[]>([]);
    const removedEdgesBackup = useRef<Edge[]>([]);

    const lastMousePosRef = useRef({ x: 0, y: 0 });
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        document.addEventListener('mousemove', handler, { passive: true });
        return () => document.removeEventListener('mousemove', handler);
    }, []);

    const connectionStartRef = useRef<{ nodeId: string | null; handleId: string | null; handleType: string | null } | null>(null);

    const relinkStateRef = useRef<RelinkState>(relinkState);
    useEffect(() => {
        relinkStateRef.current = relinkState;
    }, [relinkState]);

    const submitRelinkBatch = useCallback((newEdges: Edge[]) => {
        const removedIds = removedEdgeIds.current;
        const beforeEdgeIds = edges.map(e => e.id);
        const removedEdgesFull = edges.filter(e => removedIds.includes(e.id));
        
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

        const forward: Transaction[] = [
            ...removedIds.map(eid => ({ type: 'DISCONNECT' as const, payload: eid })),
            ...newEdges.map(e => ({ type: 'CONNECT' as const, payload: e })),
            { type: 'REORDER_EDGES' as const, payload: updated.map(e => e.id) }
        ];

        const inverse: Transaction[] = [
            ...newEdges.map(e => ({ type: 'DISCONNECT' as const, payload: e.id })),
            ...removedEdgesFull.map(e => ({ type: 'CONNECT' as const, payload: e })),
            { type: 'REORDER_EDGES' as const, payload: beforeEdgeIds }
        ];

        brain.applyTransaction({ type: 'BATCH', payload: forward });
        
        pushHistory({
            id: `relink_${newEdges[0]?.id || Date.now()}`,
            description: newEdges.length > 1 ? `Relinked ${newEdges.length} connections` : 'Modified connection',
            forward,
            inverse
        });

        setEdges(updated);
    }, [edges, setEdges, brain, pushHistory]);

    const performRelink = useCallback((targetN: string, targetH: string | null) => {
        const state = relinkStateRef.current;
        const anchorNodeId = state.targetNodeId || (state.anchors && state.anchors[0]?.nodeId);

        if (!state.active || !anchorNodeId) return;

        const dropSide = { n: targetN, h: targetH };
        let newEdgesToCreate: Edge[] = [];
        const edgesToRemove: string[] = [...removedEdgeIds.current];

        if (state.type === 'target') {
            const anchorsToConnect = state.anchors && state.anchors.length > 0
                ? state.anchors
                : [{ nodeId: state.targetNodeId!, handleId: state.targetHandleId }];

            newEdgesToCreate = anchorsToConnect
                .map(anchor => {
                    const proposed = { source: dropSide.n!, sourceHandle: dropSide.h, target: anchor.nodeId, targetHandle: anchor.handleId };
                    const edgesWithoutDragged = edges.filter(e => !removedEdgeIds.current.includes(e.id));

                    const check = BrainHelper.checkConnectionWithReplacement(brain, proposed as Edge, edgesWithoutDragged);

                    if (!check.isValid) {
                        logAction(`Relink Blocked: ${check.reason}`);
                        return null;
                    }

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
            const proposed = {
                source: state.targetNodeId!,
                sourceHandle: state.targetHandleId ?? null,
                target: dropSide.n!,
                targetHandle: dropSide.h
            };

            const edgesWithoutDragged = edges.filter(e => !removedEdgeIds.current.includes(e.id));
            const check = BrainHelper.checkConnectionWithReplacement(brain, proposed as Edge, edgesWithoutDragged);

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

        removedEdgeIds.current = Array.from(new Set(edgesToRemove));
        submitRelinkBatch(newEdgesToCreate);

        const detail = newEdgesToCreate.length > 1
            ? `${newEdgesToCreate.length} wires`
            : `${newEdgesToCreate[0].source}:${newEdgesToCreate[0].sourceHandle} -> ${newEdgesToCreate[0].target}:${newEdgesToCreate[0].targetHandle}`;

        logAction(`Relinked: ${detail}`);

    }, [edgeType, logAction, edges, submitRelinkBatch, brain]);

    const resetRelink = useCallback(() => {
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
    }, [brain]);

    const onRelinkStart = useCallback((event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
        connectionStartRef.current = params;
        if (relinkStateRef.current.active) return;
        const { nodeId, handleId, handleType } = params;
        if (!nodeId || !handleId) return;

        const isCtrl = (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey;

        if (handleType === 'source' && isCtrl) {
            const outboundEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === handleId);
            if (outboundEdges.length > 0) {
                brain.isReconnecting = true;
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
                const targetNode = brain.getNode(nodeId);
                const variant = getHandleVariant(targetNode, handleId);

                let edgeToDetach: Edge;

                if (variant === 'capsule' && inboundEdges.length > 1) {
                    const nodeDOM = document.querySelector(`[data-id="${nodeId}"]`);
                    const handleDOM = nodeDOM?.querySelector(`[data-handleid="${handleId}"]`);
                    let handleCenterY = 0;
                    if (handleDOM) {
                        const rect = handleDOM.getBoundingClientRect();
                        handleCenterY = rect.top + rect.height / 2;
                    }

                    let mouseY = 0;
                    if ('clientY' in event) {
                        mouseY = (event as MouseEvent).clientY;
                    } else {
                        const touch = (event as TouchEvent).touches[0];
                        mouseY = touch?.clientY ?? 0;
                    }

                    const total = inboundEdges.length;
                    const bestIndex = findNearestSlot(mouseY, handleCenterY, total);
                    edgeToDetach = inboundEdges[bestIndex];
                } else {
                    edgeToDetach = inboundEdges[0];
                }

                brain.isReconnecting = true;
                removedEdgeIds.current = [edgeToDetach.id];
                removedEdgesBackup.current = [edgeToDetach];
                const newState: RelinkState = { active: true, targetNodeId: edgeToDetach.source, targetHandleId: edgeToDetach.sourceHandle || null, type: 'source' };
                setRelinkState(newState);
                relinkStateRef.current = newState;
                setEdges(eds => eds.filter(e => e.id !== edgeToDetach.id));
                logAction(`Unplugged wire from ${nodeId}:${handleId}`);
            }
        }
    }, [edges, setEdges, logAction, brain]);

    const isValidRelinkConnection = useCallback(
        (connection: Edge | Connection) => {
            if (!connection.source || !connection.target) return false;
            const targetNode = brain.getNode(connection.target);
            const variant = getHandleVariant(targetNode, connection.targetHandle || '');
            const isReplacementTarget = variant === 'single';

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
        [edges, brain]
    );

    const onRelinkConnect = useCallback(
        (params: Connection) => {
            const state = relinkStateRef.current;
            if (state.active) return;

            const targetHandle = params.targetHandle;
            const existingEdge = edges.find(e =>
                e.target === params.target &&
                e.targetHandle === targetHandle
            );

            const targetNode = brain.getNode(params.target);
            const variant = getHandleVariant(targetNode, targetHandle || '');

            const isReplacementTarget = variant === 'single';
            const edgesForValidation = (existingEdge && isReplacementTarget)
                ? edges.filter(e => e.id !== existingEdge.id)
                : edges;

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

            const newEdge: Edge = {
                id: nanoid(),
                source: params.source,
                sourceHandle: params.sourceHandle,
                target: params.target,
                targetHandle: params.targetHandle,
                type: 'magnetic' as const,
                data: { pathType: edgeType }
            };

            if (isReplacementTarget && existingEdge) {
                removedEdgeIds.current = [existingEdge.id];
            } else {
                removedEdgeIds.current = [];
            }

            submitRelinkBatch([newEdge]);

            const detail = `${params.source}:${params.sourceHandle} -> ${params.target}:${params.targetHandle}`;
            logAction(`Connected: ${detail}`);
        },
        [edges, edgeType, logAction, submitRelinkBatch, brain]
    );

    const onRelinkEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: { toNode: { id: string } | null; toHandle: { id?: string | null } | null; isValid: boolean | null } | null) => {
        const state = relinkStateRef.current;
        const wasRelinking = state.active;

        let { toNode, toHandle, isValid } = connectionState || {};
        
        // Log for debugging (visible in UI action log)
        logAction(`onRelinkEnd: isValid=${isValid}, wasRelink=${wasRelinking}, startNode=${connectionStartRef.current?.nodeId}`);

        if (wasRelinking) {
            if (!toNode || !toHandle) {
                if (MagneticSnapState.nodeId && MagneticSnapState.handleId) {
                    toNode = { id: MagneticSnapState.nodeId };
                    toHandle = { id: MagneticSnapState.handleId };
                }
            }

            if (toNode && toHandle) {
                performRelink(toNode.id, toHandle.id || null);
            } else {
                removedEdgeIds.current.forEach(eid => {
                    brain.applyTransaction({ type: 'DISCONNECT', payload: eid });
                });
                logAction(`Relink canceled — wire deleted`);
            }
            resetRelink();
        } else {
            const nativeConnectWillFire = isValid === true;
            const needsSyntheticConnection = !nativeConnectWillFire && MagneticSnapState.nodeId && MagneticSnapState.handleId;

            if (needsSyntheticConnection && connectionStartRef.current?.nodeId) {
                const synthesizedConnection: Connection = {
                    source: connectionStartRef.current.nodeId,
                    sourceHandle: connectionStartRef.current.handleId || null,
                    target: MagneticSnapState.nodeId!,
                    targetHandle: MagneticSnapState.handleId! || null,
                };
                onRelinkConnect(synthesizedConnection);

            } else if (!nativeConnectWillFire && !needsSyntheticConnection && connectionStartRef.current?.nodeId && onSmartLinkSearch) {
                logAction(`Smart Link Triggered from ${connectionStartRef.current.nodeId}`);
                let screenX, screenY;
                if ('clientX' in event) {
                    screenX = (event as MouseEvent).clientX;
                    screenY = (event as MouseEvent).clientY;
                } else {
                    const touch = (event as TouchEvent).changedTouches[0];
                    screenX = touch.clientX;
                    screenY = touch.clientY;
                }

                const startNode = brain.getNode(connectionStartRef.current.nodeId);
                const startNodeDef = NODE_DEFINITIONS.find(d => d.id === startNode?.type);
                const startHandleDef = (startNode?.data?.handles as any[])?.find(h => h.id === connectionStartRef.current?.handleId)
                    || startNodeDef?.handles.find((h: any) => h.id === connectionStartRef.current?.handleId);

                const handleColor = startHandleDef 
                    ? (startHandleDef.dynamicColor && startNode?.data 
                        ? getHandleColorByConfig({ ...startHandleDef, dataType: startHandleDef.dynamicColor(startNode.data) })
                        : getHandleColorByConfig(startHandleDef)) 
                    : 'var(--color-any)';

                onSmartLinkSearch({
                    nodeId: connectionStartRef.current.nodeId,
                    handleId: connectionStartRef.current.handleId!,
                    handleType: connectionStartRef.current.handleType as 'source' | 'target',
                    handleColor, // Pass the solved color
                    position: { x: screenX, y: screenY }
                });
            }
        }
        connectionStartRef.current = null;
    }, [resetRelink, performRelink, logAction, onSmartLinkSearch, onRelinkConnect, brain]);

    const startEdgeDragDisconnect = useCallback((event: React.PointerEvent, edgeId: string) => {
        if (relinkStateRef.current.active) return;
        const edge = edges.find(e => e.id === edgeId);
        if (!edge) return;

        brain.isReconnecting = true;
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
    }, [edges, setEdges, logAction, brain]);

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
