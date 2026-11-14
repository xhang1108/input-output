import { useReactFlow, useStore, Node, Edge } from '@xyflow/react';
import { useCallback } from 'react';
import { useHistoryStore, HistoryEntry } from '../store/useHistoryStore';
import { useBrain } from '../context/BrainContext';
import { Transaction } from '../engine/types/engineTypes';
import type { MoveNodePayload } from '../engine/types/engineTypes';
import { hydrateGroupPorts } from '../utils/groupPorts';
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

/**
 * `UPDATE_NODE_DATA` parity: the Brain rounds width/height and floors them at
 * 10px. Non-finite values are left untouched (returns undefined).
 */
const normalizeSize = (value: unknown): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.round(Math.max(10, value));
};

/**
 * `RESIZE_NODE` parity: the Brain keeps `p.width` only when it is finite and
 * greater than 10, otherwise it falls back to the node's current size
 * (`node.width || 150`, `node.height || 50`) — it does not clamp to 10.
 */
const resolveResizeSize = (value: unknown, fallback: number): number => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 10) {
        return Math.round(value);
    }
    return Math.round(fallback);
};

/**
 * History restores must reproduce the Brain's position exactly. The Brain
 * ignores sub-pixel moves inside its deadzone, so restores mark every
 * MOVE_NODE (recursively, including BATCH payloads) as forced.
 * Entries themselves stay immutable; unchanged txs keep their reference.
 */
const forceMovePayload = (payload: unknown): MoveNodePayload => ({
    ...(payload as MoveNodePayload),
    force: true,
});

export const withForcedMoves = (transactions: Transaction[]): Transaction[] => {
    return transactions.map(tx => {
        if (tx.type === 'BATCH') {
            return { ...tx, payload: withForcedMoves(tx.payload as Transaction[]) };
        }
        if (tx.type === 'MOVE_NODE') {
            return { ...tx, payload: forceMovePayload(tx.payload) };
        }
        return tx;
    });
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
            case 'UPDATE_VALUE': {
                const p = tx.payload as { id: string; value: unknown };
                nextNodes = nextNodes.map(node => node.id !== p.id
                    ? node
                    : { ...node, data: { ...node.data, value: p.value } });
                break;
            }
            case 'RESIZE_NODE':
            case 'UPDATE_NODE_DATA': {
                const p = tx.payload as any;
                nextNodes = nextNodes.map(node => {
                    if (node.id !== p.id) return node;

                    const rawData = tx.type === 'UPDATE_NODE_DATA' ? p.data : p;
                    let data = rawData;
                    if (tx.type === 'RESIZE_NODE') {
                        // Mirrors TransactionManager RESIZE_NODE: values <= 10 keep
                        // the node's existing dimensions instead of clamping.
                        const baseWidth = node.width || node.measured?.width || 150;
                        const baseHeight = node.height || node.measured?.height || 50;
                        data = {
                            ...rawData,
                            width: resolveResizeSize(rawData.width, baseWidth),
                            height: resolveResizeSize(rawData.height, baseHeight),
                        };
                    } else if (tx.type === 'UPDATE_NODE_DATA') {
                        const width = normalizeSize(rawData.width);
                        const height = normalizeSize(rawData.height);
                        if (width !== undefined || height !== undefined) {
                            data = { ...rawData };
                            if (width !== undefined) data.width = width;
                            if (height !== undefined) data.height = height;
                        }
                    }
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
            case 'PATCH_SUBGRAPH': {
                // F1 diff-inverse view parity: patch the group shell's
                // data.subGraph/boundary the way TransactionManager does, so
                // undo/redo in the main view shows the restored state without
                // waiting for the next graphChanged sync.
                const p = tx.payload as {
                    id: string;
                    put: Array<{ id: string; [k: string]: unknown }>;
                    remove: string[];
                    boundary?: { inputs: unknown[]; outputs: unknown[] };
                    compiled?: unknown;
                    edges?: Array<{ id: string; source: string; target: string; [k: string]: unknown }>;
                };
                nextNodes = nextNodes.map(node => {
                    if (node.id !== p.id) return node;
                    const data = (node.data ?? {}) as Record<string, unknown>;
                    const sub = (data.subGraph ?? { nodes: [], edges: [] }) as {
                        nodes: Array<{ id: string; [k: string]: unknown }>;
                        edges: Array<{ id: string; source: string; target: string; [k: string]: unknown }>;
                    };
                    const removeSet = new Set(p.remove ?? []);
                    const putById = new Map((p.put ?? []).map(n => [n.id, n]));
                    const nodes: Array<{ id: string; [k: string]: unknown }> = [];
                    for (const n of sub.nodes ?? []) {
                        if (removeSet.has(n.id)) continue;
                        const rep = putById.get(n.id);
                        if (rep) {
                            nodes.push({ ...rep });
                            putById.delete(n.id);
                        } else {
                            nodes.push(n);
                        }
                    }
                    for (const n of putById.values()) nodes.push({ ...n });
                    const edges = p.edges !== undefined
                        ? p.edges.map(e => ({ ...e }))
                        : (sub.edges ?? []).filter(e => !removeSet.has(e.source) && !removeSet.has(e.target));
                    const boundary = (p.boundary !== undefined ? p.boundary : data.boundary) as {
                        inputs: never[];
                        outputs: never[];
                    };
                    const nextData: Record<string, unknown> = {
                        ...data,
                        subGraph: { nodes, edges },
                        boundary,
                        handles: hydrateGroupPorts(boundary),
                    };
                    if (p.compiled !== undefined) nextData.compiled = p.compiled;
                    return { ...node, data: nextData };
                });
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

export function useHistoryExecutor(options: { isReadOnly?: boolean } = {}) {
    const { isReadOnly = false } = options;
    const canUndo = useHistoryStore(s => s.past.length > 0);
    const canRedo = useHistoryStore(s => s.future.length > 0);
    const setIsRestoring = useHistoryStore(s => s.setIsRestoring);
    const popPast = useHistoryStore(s => s.popPast);
    const popFuture = useHistoryStore(s => s.popFuture);
    const pushPastSilent = useHistoryStore(s => s.pushPastSilent);
    const pushFutureSilent = useHistoryStore(s => s.pushFutureSilent);
    const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
    const brain = useBrain();

    // In-Flight Dragging Trap: Monitor React Flow store for active connection
    // We use useStore from @xyflow/react to check if a connection is being dragged
    const connectionNodeId = useStore((s: any) => s.connectionNodeId);
    const isDraggingConnection = !!connectionNodeId;

    const executeRestoration = useCallback((entry: HistoryEntry, isUndo: boolean): boolean => {
        console.log(`[History] Executing ${isUndo ? 'Undo' : 'Redo'}:`, entry.description);

        // Step A: Mute (Lock the sync)
        setIsRestoring(true);

        try {
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

            // Step C: Dual Dispatch
            // Apply to Brain first (source of truth), then project back to UI.
            // Undo/redo is silent: a rejected CONNECT (e.g. occupied single input)
            // would otherwise leave a UI-only ghost edge on the canvas.
            const res = brain.applyTransaction({ type: 'BATCH', payload: withForcedMoves(txs) }, true);

            // 「Node not found」只代表目標已消失（例如被遠端刪除），
            // UI 仍可還原其餘部分，因此視為成功。
            const isToleratedFailure = !res.success && res.reason === 'Node not found';

            if (!res.success && !isToleratedFailure) {
                // 硬失敗：不套用 UI、不搬移紀錄，由呼叫端把 entry 放回原堆疊。
                console.warn('[History] Refused:', res.reason);
                return false;
            }

            setNodes(sortParentFirst(nextNodes));
            setEdges(reconcileEdgesWithBrain(nextEdges, brain.getEdges()));

            if (isUndo) {
                pushFutureSilent(entry);
            } else {
                pushPastSilent(entry);
            }

            return true;
        } finally {
            // Step D: Unmute Synchronously (even when a throw escapes)
            setIsRestoring(false);
        }
    }, [brain, setNodes, setEdges, setIsRestoring, pushPastSilent, pushFutureSilent, getNodes, getEdges]);

    const canExecuteHistory = useCallback(() => {
        if (isReadOnly) return false;
        if (brain.isReconnecting || brain.isResizing) return false;

        const { interactionMode: currentMode } = useHistoryStore.getState();
        if (currentMode !== 'IDLE' || isDraggingConnection) {
            return false;
        }
        if (isExecutionBlocked()) {
            return false;
        }
        return true;
    }, [isReadOnly, brain, isDraggingConnection]);

    const undo = useCallback(() => {
        if (!canExecuteHistory()) {
            return;
        }

        const entry = popPast();
        if (!entry) {
            return;
        }
        if (!executeRestoration(entry, true)) {
            // 拒絕執行時把紀錄放回原本的堆疊，不可弄丟。
            pushPastSilent(entry);
        }
    }, [canExecuteHistory, popPast, pushPastSilent, executeRestoration]);

    const redo = useCallback(() => {
        if (!canExecuteHistory()) {
            return;
        }

        const entry = popFuture();
        if (!entry) {
            return;
        }
        if (!executeRestoration(entry, false)) {
            // 拒絕執行時把紀錄放回原本的堆疊，不可弄丟。
            pushFutureSilent(entry);
        }
    }, [canExecuteHistory, popFuture, pushFutureSilent, executeRestoration]);

    return {
        undo,
        redo,
        canUndo,
        canRedo
    };
}

