import { Edge } from '@xyflow/react';
import { Transaction, AddNodePayload, MoveNodePayload, UpdateValuePayload, ResizeNodePayload, GraphState, NodeLogic } from './types';
import { PayloadUtils } from '../utils/PayloadUtils';
import { getUniqueLabel } from '../utils/labelUtils';
import deepEqual from 'fast-deep-equal';

export class TransactionManager {
    constructor() { }

    /**
     * Applies a transaction to the GraphState.
     * Returns true if successful, false if reason provided.
     *
     * NOTE: This layer never signals "graph changed". The caller (Brain) owns the
     * single `graphChanged` emission, decided once per transaction from the final
     * success flag and the transaction shape. Emitting here as well (the old
     * DISCONNECT / BATCH hooks) produced duplicate topology syncs and even emitted
     * for failed batches.
     */
    public applyTransaction(
        tx: Transaction,
        state: GraphState,
        hooks: {
            onNodeAdded?: (node: NodeLogic) => void;
            onEdgeAdded?: (edge: Edge) => void;
            onNodeRemoved?: (id: string, cascadeEdges: Edge[]) => void;
            onEdgeRemoved?: (edge: Edge) => void;
            onNodeDataUpdated?: (id: string) => void;
            onNodeMoved?: (id: string) => void;
            onLog?: (msg: string) => void;
            validateConnection: (edge: Edge) => {
                isValid: boolean,
                reason?: string,
                normalized?: { source: string, sourceHandle: string, target: string, targetHandle: string }
            };
        }
    ): { success: boolean; reason?: string } {
        switch (tx.type) {
            case 'ADD_NODE': {
                const p = tx.payload as AddNodePayload;
                const initialPayload = PayloadUtils.wrap(p.initialValue);

                // Label Uniqueness Check
                let label = p.data?.label;
                if (typeof label === 'string') {
                    const existingLabels = Array.from(state.nodes.values())
                        .map(n => n.data?.label)
                        .filter(l => typeof l === 'string') as string[];
                    label = getUniqueLabel(label, existingLabels);
                }

                const newNode: NodeLogic = {
                    id: p.id,
                    type: p.type || 'baseNode',
                    value: initialPayload,
                    data: { ...p.data, label },
                    position: p.position || { x: 0, y: 0 },
                    isInDirtyChain: true,
                    selected: (p as any).selected || false,
                    parentId: p.parentId,
                    width: p.width,
                    height: p.height,
                };
                state.nodes.set(p.id, newNode);
                hooks.onNodeAdded?.(newNode);
                return { success: true };
            }

            case 'UPDATE_VALUE': {
                const p = tx.payload as UpdateValuePayload;
                const node = state.nodes.get(p.id);
                if (node) {
                    node.value = PayloadUtils.wrap(p.value);
                    node.isInDirtyChain = true;
                    node.lastUpdatedProperty = 'value';
                    hooks.onNodeDataUpdated?.(p.id);
                    return { success: true };
                }
                return { success: false, reason: 'Node not found' };
            }

            case 'CONNECT': {
                let newEdge = tx.payload as Edge;
                const validation = hooks.validateConnection(newEdge);

                if (validation.isValid) {
                    if (validation.normalized) {
                        newEdge = {
                            ...newEdge,
                            source: validation.normalized.source,
                            sourceHandle: validation.normalized.sourceHandle,
                            target: validation.normalized.target,
                            targetHandle: validation.normalized.targetHandle
                        };
                    }

                    // Idempotency guard: retries / history restores can re-apply the same
                    // edge id. Replace in place instead of pushing a duplicate.
                    const existingIndex = state.edges.findIndex(e => e.id === newEdge.id);
                    if (existingIndex >= 0) {
                        state.edges[existingIndex] = newEdge;
                    } else {
                        state.edges.push(newEdge);
                        hooks.onEdgeAdded?.(newEdge);
                    }
                    return { success: true };
                } else {
                    hooks.onLog?.(`Blocked: ${validation.reason}`);
                    return { success: false, reason: validation.reason };
                }
            }

            case 'REMOVE_NODE': {
                const id = tx.payload as string;
                if (!state.nodes.has(id)) return { success: false, reason: 'Node not found' };
                state.nodes.delete(id);

                const connectedEdges = state.edges.filter(e => e.source === id || e.target === id);
                state.edges = state.edges.filter(e => e.source !== id && e.target !== id);

                hooks.onNodeRemoved?.(id, connectedEdges);
                return { success: true };
            }

            case 'DISCONNECT': {
                const id = tx.payload as string;
                const idx = state.edges.findIndex(e => e.id === id);
                if (idx !== -1) {
                    const edgeToRemove = state.edges[idx];
                    state.edges.splice(idx, 1);
                    hooks.onEdgeRemoved?.(edgeToRemove);
                }
                return { success: true };
            }

            case 'MOVE_NODE': {
                const p = tx.payload as MoveNodePayload;
                const node = state.nodes.get(p.id);
                if (node) {
                    // COORDINATE SANITY GUARD: Block NaN/Infinity from entering state
                    if (!Number.isFinite(p.position.x) || !Number.isFinite(p.position.y)) {
                        console.warn(`[TransactionManager] Blocked MOVE_NODE for ${p.id} due to non-finite coordinates.`, p.position);
                        return { success: false, reason: 'Invalid coordinates' };
                    }

                    // DEADZONE GUARD: Ignore microscopic movements (< 0.5px) to prevent 
                    // floating point oscillations from triggering unnecessary re-evaluations.
                    const dx = Math.abs(node.position.x - p.position.x);
                    const dy = Math.abs(node.position.y - p.position.y);
                    const hasMovedSignificantly = p.force === true || dx > 0.5 || dy > 0.5;
                    const parentChanged = 'parentId' in p && (node.parentId ?? null) !== (p.parentId ?? null);

                    if (hasMovedSignificantly || parentChanged) {
                        node.position = { ...p.position };
                        if ('parentId' in p) {
                            node.parentId = p.parentId ?? undefined;
                        }
                        node.lastUpdatedProperty = 'position';
                        hooks.onNodeMoved?.(p.id);
                    }
                    return { success: true };
                }
                return { success: false, reason: 'Node not found' };
            }

            case 'RESIZE_NODE': {
                const p = tx.payload as ResizeNodePayload;
                const node = state.nodes.get(p.id);
                if (node) {
                    const w = Math.round(Number.isFinite(p.width) && p.width > 10 ? p.width : (node.width || 150));
                    const h = Math.round(Number.isFinite(p.height) && p.height > 10 ? p.height : (node.height || 50));

                    node.width = w;
                    node.height = h;
                    // Sync to data object as well
                    node.data = { ...node.data, width: w, height: h };
                    node.lastUpdatedProperty = 'dimensions';
                    hooks.onNodeDataUpdated?.(p.id);
                    return { success: true };
                }
                return { success: false, reason: 'Node not found' };
            }

            case 'UPDATE_NODE_DATA': {
                const p = tx.payload as { id: string, data: Record<string, unknown> };
                const tNode = state.nodes.get(p.id);
                if (tNode) {
                    const { selected, width, height, ...remainingData } = p.data;
                    if (selected !== undefined) {
                        tNode.selected = !!selected;
                    }

                    // Width/Height Guard: Prevent UI collapsing + integer rounding
                    if (width !== undefined && typeof width === 'number' && Number.isFinite(width)) {
                        tNode.width = Math.round(Math.max(10, width));
                        (remainingData as any).width = tNode.width;
                    }
                    if (height !== undefined && typeof height === 'number' && Number.isFinite(height)) {
                        tNode.height = Math.round(Math.max(10, height));
                        (remainingData as any).height = tNode.height;
                    }

                    // Deep Equal Guard: Only mark dirty if data content actually changed
                    if (Object.keys(remainingData).length > 0 && !deepEqual(tNode.data, { ...tNode.data, ...remainingData })) {
                        tNode.data = { ...tNode.data, ...remainingData };
                        tNode.isInDirtyChain = true;
                        tNode.lastUpdatedProperty = `data:${Object.keys(remainingData).join(',')}`;
                        hooks.onNodeDataUpdated?.(p.id);
                    }
                    return { success: true };
                }
                return { success: false, reason: 'Node not found' };
            }

            case 'BATCH': {
                const results = (tx.payload as Transaction[]).map((t: Transaction) => {
                    return this.applyTransaction(t, state, hooks);
                });
                // No emission here: the caller decides once, after checking success.

                const firstFailure = results.find(r => !r.success);
                if (firstFailure) return firstFailure;
                
                return { success: true };
            }

            case 'REORDER_EDGES': {
                const orderedIds = tx.payload as string[];
                const edgeMap = new Map(state.edges.map(e => [e.id, e]));
                const orderedIdSet = new Set(orderedIds);
                const seen = new Set<string>();
                const reordered: Edge[] = [];

                for (const eid of orderedIds) {
                    if (seen.has(eid)) continue;
                    seen.add(eid);
                    const edge = edgeMap.get(eid);
                    if (edge) reordered.push(edge);
                }
                for (const e of state.edges) {
                    if (!orderedIdSet.has(e.id) && !seen.has(e.id)) {
                        seen.add(e.id);
                        reordered.push(e);
                    }
                }
                state.edges = reordered;
                return { success: true };
            }

            default:
                return { success: false, reason: 'Unknown transaction type' };
        }
    }
}

