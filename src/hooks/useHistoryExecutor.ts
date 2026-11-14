import { useReactFlow, useStore, Node, Edge } from '@xyflow/react';
import { useCallback } from 'react';
import { useHistoryStore, HistoryEntry } from '../store/useHistoryStore';
import { useBrain } from '../context/BrainContext';
import { Transaction } from '../engine/types/engineTypes';
import { reconcileEdgesWithBrain } from '../utils/edgeUtils';
import { sortParentFirst } from '../utils/coordinates';

/**
 * Focus Defense: If user is typing in an input/textarea,
 * native undo takes precedence.
 */
const isExecutionBlocked = () => {
    const activeEl = document.activeElement as HTMLElement;
    const activeTag = activeEl?.tagName;

    // 嚴格白名單：只有這三種情況代表「真的在打字」
    return activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeEl?.isContentEditable;
};

export const computeNextState = (
    transactions: Transaction[],
    currentNodes: Node[],
    currentEdges: Edge[],
    uiMetadata?: {
        restoredNodeIndices?: Record<string, number>;
        restoredEdgeIndices?: Record<string, number>;
    }
) => {
    let nextNodes = [...currentNodes];
    let nextEdges = [...currentEdges];

    const apply = (tx: Transaction) => {
        switch (tx.type) {
            case 'BATCH': {
                (tx.payload as Transaction[]).forEach(apply);
                break;
            }
            case 'ADD_NODE': {
                // Moved to Phase 1 (Creational) for splice support
                break;
            }
            case 'REMOVE_NODE': {
                const id = tx.payload as string;
                nextNodes = nextNodes.filter(n => n.id !== id);
                break;
            }
            case 'MOVE_NODE': {
                const p = tx.payload as any;
                nextNodes = nextNodes.map(n => {
                    if (n.id !== p.id) return n;
                    const res = { ...n, position: { ...p.position } };
                    if ('parentId' in p) res.parentId = p.parentId ?? undefined;
                    return res;
                });
                break;
            }
            case 'UPDATE_VALUE':
            case 'RESIZE_NODE':
            case 'UPDATE_NODE_DATA': {
                const p = tx.payload as any;
                nextNodes = nextNodes.map(node => {
                    if (node.id !== p.id) return node;

                    const data = tx.type === 'UPDATE_NODE_DATA' ? p.data : p;
                    // 必須進行深層合併 (Deep Merge)，確保 React 偵測到 data 的記憶體位置改變
                    const res = { ...node, data: { ...node.data, ...data } };

                    // Visual Properties Sync (width, height, parentId)
                    if (data.width !== undefined) {
                        res.width = data.width;
                        res.measured = { ...res.measured, width: data.width };
                        res.style = { ...res.style, width: data.width };
                    }
                    if (data.height !== undefined) {
                        res.height = data.height;
                        res.measured = { ...res.measured, height: data.height };
                        res.style = { ...res.style, height: data.height };
                    }
                    if ('parentId' in data) res.parentId = (data.parentId as string | null) ?? undefined;

                    return res;
                });
                break;
            }
            case 'CONNECT': {
                // Moved to Phase 1 (Creational) for splice support
                break;
            }
            case 'DISCONNECT': {
                const id = tx.payload as string;
                nextEdges = nextEdges.filter(e => e.id !== id);
                break;
            }
            case 'REORDER_EDGES': {
                const orderedIds = tx.payload as string[];
                const edgeMap = new Map(nextEdges.map(e => [e.id, e]));
                const orderedIdSet = new Set(orderedIds);
                const seen = new Set<string>();
                // Immutable Sort Rule: generate a NEW array following the order
                const reordered: any[] = [];
                for (const eid of orderedIds) {
                    if (seen.has(eid)) continue;
                    seen.add(eid);
                    const edge = edgeMap.get(eid);
                    if (edge) reordered.push(edge);
                }
                // Append any edges not in the ordered list (to prevent accidental data loss)
                for (const e of nextEdges) {
                    if (!orderedIdSet.has(e.id) && !seen.has(e.id)) {
                        seen.add(e.id);
                        reordered.push(e);
                    }
                }
                nextEdges = reordered;
                break;
            }
        }
    };

    // --- Phase 1: Creational Transactions (Splice with Ascending Sort) ---
    // Handle ADD_NODE and CONNECT first to respect original stacking order.
    // We sort ascending to ensure that multiple insertions don't invalidate subsequent indices.
    const creationalTxs = transactions.filter(t => t.type === 'ADD_NODE' || t.type === 'CONNECT');
    const otherTxs = transactions.filter(t => t.type !== 'ADD_NODE' && t.type !== 'CONNECT');

    creationalTxs.sort((a, b) => {
        let idxA = 9999;
        let idxB = 9999;
        const payloadA = a.payload as any;
        const payloadB = b.payload as any;

        if (a.type === 'ADD_NODE') idxA = uiMetadata?.restoredNodeIndices?.[payloadA.id] ?? 9999;
        else idxA = uiMetadata?.restoredEdgeIndices?.[payloadA.id] ?? 9999;

        if (b.type === 'ADD_NODE') idxB = uiMetadata?.restoredNodeIndices?.[payloadB.id] ?? 9999;
        else idxB = uiMetadata?.restoredEdgeIndices?.[payloadB.id] ?? 9999;

        return idxA - idxB;
    });

    creationalTxs.forEach(tx => {
        if (tx.type === 'ADD_NODE') {
            const node = tx.payload as any;
            const index = uiMetadata?.restoredNodeIndices?.[node.id];
            if (index !== undefined && index <= nextNodes.length) {
                nextNodes.splice(index, 0, { ...node });
            } else {
                nextNodes.push({ ...node });
            }
        } else if (tx.type === 'CONNECT') {
            const edge = tx.payload as any;
            const existingIndex = nextEdges.findIndex(e => e.id === edge.id);
            if (existingIndex >= 0) {
                // Re-applying the same edge id must not append a duplicate.
                nextEdges[existingIndex] = { ...edge };
            } else {
                const index = uiMetadata?.restoredEdgeIndices?.[edge.id];
                if (index !== undefined && index <= nextEdges.length) {
                    nextEdges.splice(index, 0, { ...edge });
                } else {
                    nextEdges.push({ ...edge });
                }
            }
        }
    });

    // --- Phase 2: Positional & Structural Transactions ---
    otherTxs.forEach(apply);

    // Hierarchy invariant: whatever index the restored nodes were spliced at,
    // a parent must never sit after its child. Flat graphs stay untouched.
    if (nextNodes.some(n => n.parentId)) {
        nextNodes = sortParentFirst(nextNodes);
    }

    return { nextNodes, nextEdges };
};

export function useHistoryExecutor() {
    const past = useHistoryStore(s => s.past);
    const future = useHistoryStore(s => s.future);
    const setIsRestoring = useHistoryStore(s => s.setIsRestoring);
    const popPast = useHistoryStore(s => s.popPast);
    const popFuture = useHistoryStore(s => s.popFuture);
    const pushPastSilent = useHistoryStore(s => s.pushPastSilent);
    const pushFutureSilent = useHistoryStore(s => s.pushFutureSilent);
    const interactionMode = useHistoryStore(s => s.interactionMode);
    const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
    const brain = useBrain();

    // In-Flight Dragging Trap: Monitor React Flow store for active connection
    // We use useStore from @xyflow/react to check if a connection is being dragged
    const connectionNodeId = useStore((s: any) => s.connectionNodeId);
    const isDraggingConnection = !!connectionNodeId;

    const executeRestoration = useCallback((entry: HistoryEntry, isUndo: boolean) => {
        console.log(`[History] Executing ${isUndo ? 'Undo' : 'Redo'}:`, entry.description);

        // Step A: Mute (Lock the sync)
        setIsRestoring(true);

        const txs = isUndo ? entry.inverse : entry.forward;

        // Step B: Data Processing
        const nodesBefore = getNodes();
        const edgesBefore = getEdges();
        const { nextNodes, nextEdges } = computeNextState(
            txs,
            nodesBefore,
            edgesBefore,
            entry.uiMetadata
        );

        console.log(`[History] Nodes updated: ${nodesBefore.length} -> ${nextNodes.length}`);

        // Step C: Dual Dispatch
        // Apply to Brain first (source of truth), then project back to UI.
        // Undo/redo is silent: a rejected CONNECT (e.g. occupied single input)
        // would otherwise leave a UI-only ghost edge on the canvas.
        const res = brain.applyTransaction({ type: 'BATCH', payload: txs }, true);
        setNodes(sortParentFirst(nextNodes));
        setEdges(reconcileEdgesWithBrain(nextEdges, brain.getEdges()));
        if (!res.success) {
            console.warn('[History] Partial restore:', res.reason);
        }

        if (isUndo) {
            pushFutureSilent(entry);
        } else {
            pushPastSilent(entry);
        }

        // Step D: Unmute Synchronously
        setIsRestoring(false);
    }, [brain, setNodes, setEdges, setIsRestoring, pushPastSilent, pushFutureSilent, getNodes, getEdges]);

    const undo = useCallback(() => {
        const { interactionMode: currentMode } = useHistoryStore.getState();
        if (currentMode !== 'IDLE' || isDraggingConnection) {
            return;
        }
        if (isExecutionBlocked()) {
            return;
        }

        const entry = popPast();
        if (!entry) {
            return;
        }
        executeRestoration(entry, true);
    }, [popPast, executeRestoration, isDraggingConnection]);

    const redo = useCallback(() => {
        const { interactionMode: currentMode } = useHistoryStore.getState();
        if (currentMode !== 'IDLE' || isDraggingConnection) {
            return;
        }
        if (isExecutionBlocked()) {
            return;
        }

        const entry = popFuture();
        if (!entry) {
            return;
        }
        executeRestoration(entry, false);
    }, [popFuture, executeRestoration, isDraggingConnection]);

    return {
        undo,
        redo,
        canUndo: past.length > 0,
        canRedo: future.length > 0
    };
}

