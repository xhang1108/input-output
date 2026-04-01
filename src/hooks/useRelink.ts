import { useCallback, useRef, useState, useEffect } from 'react';
import { Edge, Connection, OnConnectStartParams, useStore } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
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
    onSmartLinkSearch?: (params: { nodeId: string; handleId: string; handleType: 'source' | 'target'; handleColor: string; position: { x: number; y: number } }) => void;
};

export function useRelink({
    setEdges,
    logAction,
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
    const processingRelinkRef = useRef(false); // New lock ref

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
        const currentEdges = edges;
        
        // RESOLVE: Ensure backup contains ALL actual edge objects being removed
        // (both already detached ones and newly replaced ones)
        const removedEdgesInStore = currentEdges.filter(e => removedIds.includes(e.id));
        const removedEdgesFull = [...removedEdgesBackup.current];
        for (const re of removedEdgesInStore) {
            if (!removedEdgesFull.some(be => be.id === re.id)) {
                removedEdgesFull.push(re);
            }
        }

        const beforeEdgeIds = currentEdges.map(e => e.id);
        let updated = currentEdges.filter(e => !removedIds.includes(e.id));

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
            description: newEdges.length > 1 ? `Relinked ${newEdges.length} connection(s)` : 'Modified connection',
            forward,
            inverse
        });

        // 3.0 PURGE: Centrally clear removal buffers after any submission
    removedEdgesBackup.current = [];
    }, [edges, brain, pushHistory]);

    /** Helper to transform internal IDs like 'MA-01_hash:in_a' to '[Basic Math - 01] A' */
    const formatIdentifier = useCallback((id: string) => {
        // Regex to find 'NodeID:HandleID' or just 'NodeID'
        return id.replace(/([A-Z0-9-]+)_([a-z0-9]+)(:[a-z0-9_]+)?/g, (match, typeId, hash, handlePart) => {
            const nodeId = `${typeId}_${hash}`;
            const nodeLogic = brain.getNode(nodeId);
            const def = NODE_DEFINITIONS.find(d => d.id === typeId);
            
            // Priority: 1. Custom Label from Brain | 2. Static Label | 3. Base ID
            const nodeLabel = nodeLogic?.data?.label as string || def?.label || typeId;
            const shortIdx = typeId.includes('-') ? typeId.split('-')[1] : typeId;
            
            const handleId = handlePart ? handlePart.substring(1) : null; // Remove the ':'
            let handleLabel = '';
            
            if (handleId) {
                const handleDef = def?.handles.find(h => h.id === handleId);
                handleLabel = ' ' + (handleDef?.label || handleId.replace(/^in_/, '').replace(/^out_/, '').toUpperCase());
            }
            
            return `[${nodeLabel}]${handleLabel}`;
        });
    }, []);

    const performRelink = useCallback((targetN: string, targetH: string | null): boolean => {
        const startParams = connectionStartRef.current;
        if (!startParams) {
            logAction('No relink starting point found');
            return false;
        }
        const state = relinkStateRef.current;
        const anchorNodeId = state.targetNodeId || (state.anchors && state.anchors[0]?.nodeId);

        if (!state.active || !anchorNodeId) return false;

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
                        toast.error(formatIdentifier(check.reason || 'Invalid connection'));
                        return null;
                    }

                    if (check.edgeToReplace) {
                        edgesToRemove.push(check.edgeToReplace.id);
                        if (!removedEdgesBackup.current.some(e => e.id === check.edgeToReplace!.id)) {
                            removedEdgesBackup.current.push(check.edgeToReplace);
                        }
                    }

                    return {
                        id: nanoid(),
                        source: dropSide.n!,
                        sourceHandle: dropSide.h,
                        target: anchor.nodeId,
                        targetHandle: anchor.handleId,
                        type: 'magnetic' as const,
                        data: { pathType: 'bezier' }
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
                    data: { pathType: 'bezier' }
                };
                newEdgesToCreate.push(newEdge);

                if (check.edgeToReplace) {
                    edgesToRemove.push(check.edgeToReplace.id);
                    if (!removedEdgesBackup.current.some(e => e.id === check.edgeToReplace!.id)) {
                        removedEdgesBackup.current.push(check.edgeToReplace);
                    }
                }
            } else {
                logAction(`Relink Blocked: ${check.reason}`);
                toast.error(formatIdentifier(check.reason || 'Invalid connection'));
                return false;
            }
        }

        removedEdgeIds.current = Array.from(new Set(edgesToRemove));
        
        if (newEdgesToCreate.length > 0) {
            submitRelinkBatch(newEdgesToCreate);
            const detail = newEdgesToCreate.length > 1
                ? `${newEdgesToCreate.length} wires`
                : `${newEdgesToCreate[0].source}:${newEdgesToCreate[0].sourceHandle} -> ${newEdgesToCreate[0].target}:${newEdgesToCreate[0].targetHandle}`;
            logAction(`Relinked: ${detail}`);
            return true;
        } else {
            return false;
        }

    }, [logAction, edges, submitRelinkBatch, brain]);

    const resetRelink = useCallback(() => {
        const emptyState: RelinkState = {
            active: false,
            targetNodeId: null,
            targetHandleId: null,
            type: 'target',
            anchors: []
        };
        brain.isReconnecting = false;
        removedEdgeIds.current = [];
        removedEdgesBackup.current = [];
        capsulePreviewState.clear();
        
        // Atomic synchronous update to ref (crucial for valid-relink detection in next frame)
        relinkStateRef.current = emptyState;
        setRelinkState(emptyState);
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
            
            const state = relinkStateRef.current;
            
            let sourceId = connection.source;
            let sourceHandle = connection.sourceHandle;
            let targetId = connection.target;
            let targetHandle = connection.targetHandle;

            // SEMANTIC FIX: If Relink is active, the "Fixed" end is the source/target 
            // of the validation, NOT React Flow's proposed source/target.
            if (state.active) {
                if (state.type === 'source') {
                    // We are dragging the Target end. Fixed end is the Source.
                    sourceId = state.targetNodeId!;
                    sourceHandle = state.targetHandleId;
                    // The "Moving" end (connection.target or connection.source) is the new Target.
                    // React Flow might swap source/target in Loose mode, so we pick the one that's NOT the fixed node.
                    const movingNodeId = connection.source === state.targetNodeId ? connection.target : connection.source;
                    const movingHandleId = connection.source === state.targetNodeId ? connection.targetHandle : connection.sourceHandle;
                    targetId = movingNodeId;
                    targetHandle = movingHandleId || null;
                } else {
                    // We are dragging the Source end. Fixed end is the Target.
                    targetId = state.targetNodeId!;
                    targetHandle = state.targetHandleId;
                    // The "Moving" end is the new Source.
                    const movingNodeId = connection.source === state.targetNodeId ? connection.target : connection.source;
                    const movingHandleId = connection.source === state.targetNodeId ? connection.targetHandle : connection.sourceHandle;
                    sourceId = movingNodeId;
                    sourceHandle = movingHandleId || null;
                }
            }

            const targetNode = brain.getNode(targetId);
            const variant = getHandleVariant(targetNode, targetHandle || '');
            const isReplacementTarget = variant === 'single';

            const edgesForValidation = isReplacementTarget
                ? edges.filter(e => !(e.target === targetId && e.targetHandle === targetHandle))
                : edges;

            const validation = brain.validateConnection(
                sourceId,
                sourceHandle,
                targetId,
                targetHandle,
                edgesForValidation
            );

            return validation.isValid;
        },
        [edges, brain]
    );

    const onRelinkConnect = useCallback(
        (params: Connection) => {
            const state = relinkStateRef.current;
            
            // 3.0 HARD PURGE: If this is NOT an active relink (e.g. Standard mouse-down-drag-up),
            // we must ensure previous failed relink's IDs are not in the buffer!
            if (!state.active) {
                removedEdgeIds.current = [];
                removedEdgesBackup.current = [];
            }

            // Block if Relink is active OR was just processed in the same JS tick
            if (state.active || processingRelinkRef.current) return;

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
                toast.error(formatIdentifier(validation.reason || 'Invalid connection'));
                // 5.0 EMERGENCY UI RESTORE: If replacement is blocked, restore the original edge to the UI immediately.
                // This prevents 'Clean UI vs Dirty Brain' desynchronization.
                if (existingEdge && isReplacementTarget) {
                    setEdges(eds => [...eds, existingEdge]);
                }
                return;
            }

            const newEdge: Edge = {
                id: nanoid(),
                source: params.source,
                sourceHandle: params.sourceHandle,
                target: params.target,
                targetHandle: params.targetHandle,
                type: 'magnetic' as const,
                data: { pathType: 'bezier' }
            };

            if (isReplacementTarget && existingEdge) {
                removedEdgeIds.current = [existingEdge.id];
                removedEdgesBackup.current = [existingEdge];
            } else {
                removedEdgeIds.current = [];
                // CRITICAL: Always clear backup if no relink is active to prevent ghost snap-backs
                if (!state.active) removedEdgesBackup.current = [];
            }

            submitRelinkBatch([newEdge]);

            const detail = `${params.source}:${params.sourceHandle} -> ${params.target}:${params.targetHandle}`;
            logAction(`Connected: ${detail}`);
        },
        [edges, logAction, submitRelinkBatch, brain]
    );

    const onRelinkEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: any) => {
        const capturedStartParams = connectionStartRef.current;
        const wasRelinking = relinkStateRef.current.active;
        
        if (wasRelinking) {
            processingRelinkRef.current = true;
            setTimeout(() => { processingRelinkRef.current = false; }, 100);
        }

        let { toNode, toHandle, isValid } = connectionState || {};
        
        if (wasRelinking) {
            // Support magnetic snapping even if React Flow doesn't report it
            if (!toNode || !toHandle) {
                if (MagneticSnapState.nodeId && MagneticSnapState.handleId) {
                    toNode = { id: MagneticSnapState.nodeId };
                    toHandle = { id: MagneticSnapState.handleId };
                }
            }

            if (toNode && toHandle) {
                const success = performRelink(toNode.id, toHandle.id || null);
                if (success) {
                    resetRelink();
                    connectionStartRef.current = null;
                    return;
                }
            }

            // FAILURE / AIR DROP / ILLEGAL BRANCH:
            // 7.0 TOTAL DISCONNECT: If we reach here, it means we either dropped in air 
            // OR performRelink returned false (illegal). We commit a physical disconnect.
            const removedIds = removedEdgeIds.current;
            const backups = removedEdgesBackup.current;

            if (removedIds.length > 0 && backups.length > 0) {
                const forward: Transaction[] = removedIds.map(id => ({ type: 'DISCONNECT' as const, payload: id }));
                const inverse: Transaction[] = backups.map(e => ({ type: 'CONNECT' as const, payload: e }));

                brain.applyTransaction({ type: 'BATCH', payload: forward });
                
                // 8.1 FIX: Only show info toast if it was a drop-in-air (not a validation failure already toasted)
                if (!toNode) {
                    toast.info('Connection removed (dropped in air)');
                }

                pushHistory({
                    id: `relink_fail_${Date.now()}`,
                    description: `Relink aborted or invalid — connection deleted`,
                    forward,
                    inverse
                });
                logAction(`Relink failed or dropped — connection deleted physically`);
            } else {
                // Check for Smart Link Trigger
                if (capturedStartParams?.nodeId && onSmartLinkSearch) {
                    logAction(`Smart Link Triggered from ${capturedStartParams.nodeId}`);
                    let screenX, screenY;
                    if ('clientX' in event) {
                        screenX = (event as MouseEvent).clientX;
                        screenY = (event as MouseEvent).clientY;
                    } else {
                        const touch = (event as TouchEvent).changedTouches[0] || (event as TouchEvent).touches[0];
                        screenX = touch?.clientX || 0;
                        screenY = touch?.clientY || 0;
                    }

                    const startNode = brain.getNode(capturedStartParams.nodeId);
                    const startNodeDef = NODE_DEFINITIONS.find(d => d.id === startNode?.type);
                    const startHandleDef = (startNode?.data?.handles as any[])?.find(h => h.id === capturedStartParams?.handleId)
                        || startNodeDef?.handles.find((h: any) => h.id === capturedStartParams?.handleId);

                    const handleColor = startHandleDef 
                        ? (startHandleDef.dynamicColor && startNode?.data 
                            ? getHandleColorByConfig({ ...startHandleDef, dataType: startHandleDef.dynamicColor(startNode.data) })
                            : getHandleColorByConfig(startHandleDef)) 
                        : 'var(--color-any)';

                    onSmartLinkSearch({
                        nodeId: capturedStartParams.nodeId,
                        handleId: capturedStartParams.handleId!,
                        handleType: capturedStartParams.handleType as 'source' | 'target',
                        handleColor,
                        position: { x: screenX, y: screenY }
                    });
                }
            }
            
            resetRelink();
        } else {
            // Standard Connection End: Handle synthetic snapping (Auto-magnet)
            const nativeConnectWillFire = isValid === true;
            const needsSyntheticConnection = !nativeConnectWillFire && MagneticSnapState.nodeId && MagneticSnapState.handleId;

            if (needsSyntheticConnection && capturedStartParams?.nodeId) {
                onRelinkConnect({
                    source: capturedStartParams.nodeId,
                    sourceHandle: capturedStartParams.handleId || null,
                    target: MagneticSnapState.nodeId!,
                    targetHandle: MagneticSnapState.handleId! || null,
                });
            }
        }
        
        connectionStartRef.current = null;
    }, [performRelink, resetRelink, brain, pushHistory, logAction, onSmartLinkSearch, onRelinkConnect]);

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
