import { Edge } from '@xyflow/react';
import { Transaction, AddNodePayload, MoveNodePayload, UpdateValuePayload, ResizeNodePayload, GraphState, NodeLogic } from './types';
import { HistoryManager } from './HistoryManager';
import { PayloadUtils } from '../utils/PayloadUtils';
import { IncrementalPatch } from './SerializableGraph';
import { NodePayload } from '../types/payload';

export class TransactionManager {
    private history: HistoryManager;

    constructor() {
        this.history = new HistoryManager();
    }

    public clearHistory() {
        this.history.clear();
    }

    public undo(applyTx: (tx: Transaction, record: boolean, silent: boolean) => void): Transaction | null {
        const entry = this.history.undo();
        if (entry) {
            applyTx(entry.undo, false, true);
            return entry.undo;
        }
        return null;
    }

    public redo(applyTx: (tx: Transaction, record: boolean, silent: boolean) => void): Transaction | null {
        const entry = this.history.redo();
        if (entry) {
            applyTx(entry.do, false, true);
            return entry.do;
        }
        return null;
    }

    public recordTransaction(tx: Transaction, inverseTx: Transaction | null) {
        if (inverseTx) {
            this.history.push({ do: tx, undo: inverseTx });
        }
    }

    /**
     * Generates the inverse transaction for Undo.
     * Needs readonly access to current state to build restore payloads.
     */
    public createInverseTransaction(tx: Transaction, state: GraphState): Transaction | null {
        switch (tx.type) {
            case 'ADD_NODE':
                return { type: 'REMOVE_NODE', payload: (tx.payload as AddNodePayload).id };

            case 'REMOVE_NODE': {
                const id = tx.payload as string;
                const node = state.nodes.get(id);
                if (!node) return null;

                const addNodeTx: Transaction = {
                    type: 'ADD_NODE',
                    payload: {
                        id: node.id,
                        initialValue: node.value,
                        type: node.type,
                        data: { ...node.data },
                        position: node.position,
                        parentId: node.parentId
                    } as AddNodePayload
                };

                const connectedEdges = state.edges.filter(
                    e => e.source === (tx.payload as string) || e.target === (tx.payload as string)
                );

                if (connectedEdges.length === 0) {
                    return addNodeTx;
                }

                return {
                    type: 'BATCH',
                    payload: [
                        addNodeTx,
                        ...connectedEdges.map(e => ({
                            type: 'CONNECT' as const,
                            payload: { ...e }
                        }))
                    ]
                };
            }

            case 'CONNECT':
                return { type: 'DISCONNECT', payload: (tx.payload as Edge).id };

            case 'DISCONNECT': {
                const edge = state.edges.find(e => e.id === (tx.payload as string));
                if (!edge) return null;
                return { type: 'CONNECT', payload: { ...edge } };
            }

            case 'MOVE_NODE': {
                const p = tx.payload as MoveNodePayload;
                const node = state.nodes.get(p.id);
                if (!node) return null;
                const restorePos = p.oldPosition || node.position || { x: 0, y: 0 };

                return {
                    type: 'MOVE_NODE',
                    payload: {
                        id: node.id,
                        position: restorePos,
                        parentId: node.parentId
                    }
                };
            }

            case 'RESIZE_NODE': {
                const p = tx.payload as ResizeNodePayload;
                const node = state.nodes.get(p.id);
                if (!node) return null;
                const restoreSize = p.oldSize || {
                    width: node.measured?.width ?? node.width ?? 0,
                    height: node.measured?.height ?? node.height ?? 0
                };

                return {
                    type: 'RESIZE_NODE',
                    payload: {
                        id: node.id,
                        width: restoreSize.width,
                        height: restoreSize.height
                    }
                };
            }

            case 'UPDATE_NODE_DATA': {
                const p = tx.payload as { id: string, data: Record<string, unknown> };
                const node = state.nodes.get(p.id);
                if (!node) return null;
                const oldData: Record<string, unknown> = {};
                for (const key in p.data) {
                    oldData[key] = node.data[key];
                }
                return {
                    type: 'UPDATE_NODE_DATA',
                    payload: { id: node.id, data: oldData }
                };
            }

            case 'BATCH': {
                const inverses = (tx.payload as Transaction[])
                    .map(t => this.createInverseTransaction(t, state))
                    .reverse(); // Apply in reverse order
                return { type: 'BATCH', payload: inverses };
            }

            case 'REORDER_EDGES': {
                return {
                    type: 'REORDER_EDGES',
                    payload: state.edges.map(e => e.id)
                };
            }

            default:
                return null;
        }
    }

    /**
     * Applies a transaction to the GraphState.
     * Returns true if successful, false if reason provided.
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
            onGraphChanged?: () => void;
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

                const newNode: NodeLogic = {
                    id: p.id,
                    type: p.type || 'baseNode',
                    value: initialPayload,
                    data: p.data || {},
                    position: p.position as { x: number; y: number },
                    isInDirtyChain: true,
                    selected: (p as any).selected || false,
                    parentId: p.parentId,
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
                    state.edges.push(newEdge);
                    hooks.onEdgeAdded?.(newEdge);
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
                const edgeId = tx.payload as string;
                const edgeToRemove = state.edges.find(e => e.id === edgeId);
                if (edgeToRemove) {
                    state.edges = state.edges.filter(e => e.id !== edgeId);
                    hooks.onEdgeRemoved?.(edgeToRemove);
                    return { success: true };
                }
                return { success: false, reason: 'Edge not found' };
            }

            case 'MOVE_NODE': {
                const p = tx.payload as MoveNodePayload;
                const node = state.nodes.get(p.id);
                if (node) {
                    node.position = p.position;
                    if (p.parentId !== undefined) {
                        node.parentId = p.parentId;
                    }
                    hooks.onNodeMoved?.(p.id);
                    return { success: true };
                }
                return { success: false, reason: 'Node not found' };
            }

            case 'RESIZE_NODE': {
                const p = tx.payload as ResizeNodePayload;
                const node = state.nodes.get(p.id);
                if (node) {
                    node.width = p.width;
                    node.height = p.height;
                    hooks.onNodeDataUpdated?.(p.id); // Trigger visual update
                    return { success: true };
                }
                return { success: false, reason: 'Node not found' };
            }

            case 'UPDATE_NODE_DATA': {
                const p = tx.payload as { id: string, data: Record<string, unknown> };
                const tNode = state.nodes.get(p.id);
                if (tNode) {
                    const { selected, ...remainingData } = p.data;
                    if (selected !== undefined) {
                        tNode.selected = !!selected;
                    }
                    tNode.data = { ...tNode.data, ...remainingData };
                    tNode.isInDirtyChain = true;
                    hooks.onNodeDataUpdated?.(p.id);
                    return { success: true };
                }
                return { success: false, reason: 'Node not found' };
            }

            case 'BATCH':
                (tx.payload as Transaction[]).forEach((t: Transaction) => {
                    this.applyTransaction(t, state, hooks);
                });
                hooks.onGraphChanged?.();
                return { success: true };

            case 'REORDER_EDGES': {
                const orderedIds = tx.payload as string[];
                const edgeMap = new Map(state.edges.map(e => [e.id, e]));
                const reordered: Edge[] = [];
                for (const eid of orderedIds) {
                    const edge = edgeMap.get(eid);
                    if (edge) reordered.push(edge);
                }
                for (const e of state.edges) {
                    if (!orderedIds.includes(e.id)) reordered.push(e);
                }
                state.edges = reordered;
                return { success: true };
            }

            default:
                return { success: false, reason: 'Unknown transaction type' };
        }
    }
}
