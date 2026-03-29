import { Edge } from '@xyflow/react';
import { Transaction, AddNodePayload, MoveNodePayload, UpdateValuePayload, ResizeNodePayload, GraphState, NodeLogic } from './types';
import { PayloadUtils } from '../utils/PayloadUtils';
import { getUniqueLabel } from '../utils/labelUtils';

export class TransactionManager {
    constructor() {}

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
                    // Sync to data object as well, as many functional components 
                    // (like MatrixInputNode) use data.width/height as the primary reference
                    node.data = { ...node.data, width: p.width, height: p.height };
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
