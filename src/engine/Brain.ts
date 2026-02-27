import { NodePayload } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';
import { Edge } from '@xyflow/react';
import { GraphState, NodeLogic, Transaction, AddNodePayload, MoveNodePayload, UpdateValuePayload } from './types';
import { HistoryManager } from './HistoryManager';
import { NodeRegistry } from './NodeRegistry'; // Static Import
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';
import { getHandleVariant, isProbablyInputHandle } from '../utils/handleUtils';
// BrainWorkerProxy is imported DYNAMICALLY in initWorker() to avoid circular dependency
import type { IncrementalPatch } from './SerializableGraph';
import { useAppStore } from '../store/useStore';
import { TopologyManager } from './TopologyManager';
import { WorkerOrchestrator } from './WorkerOrchestrator';

export class Brain {
    private static instance: Brain;
    private state: GraphState;

    private topology: TopologyManager;
    private worker: WorkerOrchestrator;

    /** Tracks pending topology changes for incremental patches */
    private pendingPatch: IncrementalPatch = { dirtyChainNodeIds: [] };

    private constructor() {
        this.state = {
            nodes: new Map(),
            edges: [],
        };

        this.topology = new TopologyManager();
        this.worker = new WorkerOrchestrator({
            onResults: (patches, latency) => {
                this.applyWorkerResults(patches);
                useAppStore.getState().setLastEvalMs(latency);
            },
            onTriggerDirty: (id) => this.triggerDirtyChain(id),
            syncRequester: () => this.syncWorker(),
            emit: (ev, p) => this.emit(ev, p)
        });

        // Worker is lazily initialized on first heartbeat that needs it
        this.startHeartbeat();
    }

    private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();

    private isRecalculating = false;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_MS = 16; // ~60fps


    /** Apply Worker-computed results back into main-thread state */
    private applyWorkerResults(patches: Map<string, NodePayload>) {
        for (const [id, payload] of patches) {
            const node = this.state.nodes.get(id);
            if (node) {
                node.value = payload;
                node.isInDirtyChain = false;
            }
        }
        this.isRecalculating = false;

        const freshlyUpdated = this.worker.getFreshlyUpdated();
        if (freshlyUpdated.size > 0) {
            for (const nodeId of freshlyUpdated) {
                this.triggerDirtyChain(nodeId);
            }
        }

        if (patches.size > 0) {
            this.emit('graphChanged', patches);
        }
    }

    private async syncWorker() {
        if (!this.worker.isEnabled()) return;
        const { BrainWorkerProxy } = await import('./BrainWorkerProxy');
        const snapshot = BrainWorkerProxy.buildSnapshot(this.state.nodes, this.state.edges);
        this.worker.getProxy()?.syncGraph(snapshot);
    }

    /** Build incremental patch from accumulated changes and reset */
    private async consumePatch(): Promise<IncrementalPatch> {
        const patch = this.pendingPatch;
        const { BrainWorkerProxy } = await import('./BrainWorkerProxy');
        const updatedNodes: IncrementalPatch['updatedNodes'] = [];

        const freshlyUpdated = this.worker.getFreshlyUpdated();
        for (const nodeId of freshlyUpdated) {
            const node = this.state.nodes.get(nodeId);
            if (node) {
                updatedNodes.push(BrainWorkerProxy.serializeNode(node));
            }
        }
        this.worker.clearFreshlyUpdated();

        // Include dirty nodes
        for (const node of this.state.nodes.values()) {
            if (node.isInDirtyChain) {
                if (!patch.dirtyChainNodeIds.includes(node.id)) {
                    patch.dirtyChainNodeIds.push(node.id);
                }
                updatedNodes.push(BrainWorkerProxy.serializeNode(node));
            }
        }

        if (updatedNodes.length > 0) {
            patch.updatedNodes = [...(patch.updatedNodes || []), ...updatedNodes];
        }
        this.pendingPatch = { dirtyChainNodeIds: [] };
        return patch;
    }

    /** Toggle Worker mode at runtime */
    public async setWorkerMode(enabled: boolean) {
        await this.worker.init();
        if (this.worker.isEnabled()) {
            await this.syncWorker();
        }
    }

    /** Get current Worker mode */
    public isWorkerMode(): boolean {
        return this.worker.isEnabled();
    }

    private startHeartbeat() {
        if (this.heartbeatInterval) return;

        this.heartbeatInterval = setInterval(async () => {
            if (this.isRecalculating) return;

            const hasDirty = Array.from(this.state.nodes.values()).some(n => n.isInDirtyChain)
                || this.worker.getFreshlyUpdated().size > 0;
            if (hasDirty) {
                this.isRecalculating = true;

                if (this.worker.isEnabled()) {
                    await this.worker.syncAndEval(this.state.nodes, this.state.edges, this.topology);
                } else {
                    try {
                        const patches = await this.recalculateDirtyChain();
                        if (patches.size > 0) {
                            this.emit('graphChanged', patches);
                        }
                    } finally {
                        this.isRecalculating = false;
                    }
                }
            }
        }, this.HEARTBEAT_MS);
    }

    public static getInstance(): Brain {
        if (!Brain.instance) {
            Brain.instance = new Brain();
        }
        return Brain.instance;
    }

    public on(eventType: string, callback: (payload: unknown) => void): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)?.add(callback);

        // Return cleanup function
        return () => this.off(eventType, callback);
    }

    public off(eventType: string, callback: (payload: unknown) => void) {
        this.listeners.get(eventType)?.delete(callback);
    }

    private emit(eventType: string, payload: unknown) {
        const listeners = this.listeners.get(eventType);
        listeners?.forEach(cb => cb(payload));
    }

    private log(msg: string) {
        this.emit('log', msg);
    }

    // --- State Accessors ---



    // --- Topology Management ---

    private updateAdjacency(edge: Edge, action: 'ADD' | 'REMOVE') {
        this.topology.updateAdjacency(edge, action);
    }

    // --- Pulse Engine (Dirty & Pull) ---

    // 1. Dirty Propagation (The Pulse Wave)
    // FIX: Instead of aggressive full-depth propagation (Over-propagation),
    // we only mark the IMMEDIATELY connected children as dirty.
    // Deep propagation will now happen stepwise during recalculateDirtyChain
    // if and only if the parent's actual computed value changed.
    private triggerDirtyChain(startNodeId: string) {
        this.topology.triggerDirtyChain(startNodeId, this.state.nodes);
    }

    public clearAll() {
        this.state = {
            nodes: new Map(),
            edges: [],
        };
        this.topology.clear();
        this.history.clear();
        this.pendingPatch = { dirtyChainNodeIds: [] };
        if (this.worker.isEnabled()) {
            this.worker.getProxy()?.clearState();
        }
        this.emit('graphChanged', null);
    }

    /** Clears all state silently — no events emitted. Use before mounting UI. */
    public silentReset() {
        this.state = {
            nodes: new Map(),
            edges: [],
        };
        this.topology.clear();
        this.pendingPatch = { dirtyChainNodeIds: [] };
        if (this.worker.isEnabled()) {
            this.worker.getProxy()?.clearState();
        }
    }

    private markAllDirty() {
        this.state.nodes.forEach(node => {
            node.isInDirtyChain = true;
        });
    }

    // 2. Pull Evaluation (The Calculation)
    // Phase 2.1: Updated to return NodePayload
    // Phase 4.1: Cycle Detection via `computingPath`
    public async getValue(nodeId: string, sourceHandle?: string, computingPath: Set<string> = new Set()): Promise<NodePayload> {
        const node = this.state.nodes.get(nodeId);
        if (!node) return PayloadUtils.createError('Node not found');

        // Circular Dependency Detection (Fatal Flaw 1 Fix)
        if (computingPath.has(nodeId)) {
            console.warn(`[Brain] Cycle detected at node ${nodeId}!`);
            return PayloadUtils.createError('Cycle Detected');
        }

        let resultPayload: NodePayload;

        // 1. Get/Calculate the node's current value
        if (!node.isInDirtyChain && node.value) {
            resultPayload = node.value;
        } else {
            // We are about to compute this node. Mark it in the path to prevent infinite loops.
            const newPath = new Set(computingPath);
            newPath.add(nodeId);

            const inputs = this.topology.getInputs(nodeId);

            // Sort inputs by edge array order so capsule multi-input evaluation
            // matches the visual display order set by user interaction.
            const sortedInputs = [...inputs].sort((a, b) => {
                const edgeA = this.state.edges.findIndex(e =>
                    e.source === a.nodeId && e.sourceHandle === a.sourceHandle &&
                    e.target === nodeId && e.targetHandle === a.targetHandle
                );
                const edgeB = this.state.edges.findIndex(e =>
                    e.source === b.nodeId && e.sourceHandle === b.sourceHandle &&
                    e.target === nodeId && e.targetHandle === b.targetHandle
                );
                return edgeA - edgeB;
            });

            const inputPayloads: Record<string, any> = {};

            for (const input of sortedInputs) {
                // Pass sourceHandle to ensure multi-output nodes work
                // Pass newPath to detect cycles downstream
                const payload = await this.getValue(input.nodeId, input.sourceHandle, newPath);

                if (input.targetHandle) {
                    if (input.targetHandle in inputPayloads) {
                        const existing = inputPayloads[input.targetHandle];
                        if (Array.isArray(existing)) {
                            existing.push(payload);
                        } else {
                            inputPayloads[input.targetHandle] = [existing, payload];
                        }
                    } else {
                        inputPayloads[input.targetHandle] = payload;
                    }
                }
            }

            // Compute
            const oldPayload = node.value;
            resultPayload = await this.computeNode(node, inputPayloads as any);

            // Update & Clean
            node.value = resultPayload;
            node.isInDirtyChain = false;

            // Stepwise Propagation: Only propagate if the value ACTUALLY changed.
            // This prevents "Performance Avalanches" (Fatal Flaw 4 Fix)
            if (oldPayload && JSON.stringify(oldPayload) !== JSON.stringify(resultPayload)) {
                this.triggerDirtyChain(nodeId);
            } else if (!oldPayload) {
                this.triggerDirtyChain(nodeId);
            }
        }

        // 2. Handle specific Handle extraction
        if (sourceHandle && typeof resultPayload.value === 'object' && resultPayload.value !== null) {
            const multiValue = resultPayload.value as Record<string, unknown>;
            if (sourceHandle in multiValue) {
                const subValue = multiValue[sourceHandle];

                const parentMeta = resultPayload.meta || {};
                const handleMeta = parentMeta.handleMeta?.[sourceHandle] || {};
                const newMeta = { ...parentMeta, ...handleMeta };

                if (subValue && typeof subValue === 'object' && 'type' in subValue && 'value' in subValue) {
                    return {
                        ...(subValue as NodePayload),
                        meta: { ...(subValue as NodePayload).meta, ...newMeta }
                    };
                }

                return {
                    ...resultPayload,
                    value: subValue,
                    meta: newMeta
                };
            }
        }

        return resultPayload;
    }

    /**
     * Recalculates all dirty nodes in the graph.
     */
    private async recalculateDirtyChain(): Promise<Map<string, NodePayload>> {
        const patches = new Map<string, NodePayload>();

        const dirtyChainNodeIds = Array.from(this.state.nodes.values())
            .filter(n => n.isInDirtyChain)
            .map(n => n.id);

        for (const id of dirtyChainNodeIds) {
            const node = this.state.nodes.get(id);
            if (!node) continue;

            // Trigger Pull
            const newPayload = await this.getValue(id);
            patches.set(id, newPayload);
        }

        return patches;
    }

    // 3. Primitve Node Registry
    private async computeNode(node: NodeLogic, inputs: Record<string, NodePayload>): Promise<NodePayload> {
        // Use Registry for evaluation
        // This decouples specific node logic from the Brain
        try {
            return await NodeRegistry.evaluate(node, inputs);
        } catch (error) {
            console.error(`Error computing node ${node.id}:`, error);
            return PayloadUtils.createError('Computation Failed');
        }
    }

    /**
     * Synchronously peeks at the current cached value of a node.
     * Does NOT trigger recalculation. Useful for UI lookups (sniffing).
     */
    public peekValue(nodeId: string, sourceHandle?: string): NodePayload | null {
        const node = this.state.nodes.get(nodeId);
        if (!node) return null;

        const resultPayload = node.value;
        if (!resultPayload) return null;

        // Handle specific Handle extraction (Phase 2.2 Multi-Output)
        if (sourceHandle && typeof resultPayload.value === 'object' && resultPayload.value !== null) {
            const multiValue = resultPayload.value as Record<string, unknown>;
            if (sourceHandle in multiValue) {
                const subValue = multiValue[sourceHandle];
                const parentMeta = resultPayload.meta || {};
                const handleMeta = parentMeta.handleMeta?.[sourceHandle] || {};
                const newMeta = { ...parentMeta, ...handleMeta };

                if (subValue && typeof subValue === 'object' && 'type' in subValue && 'value' in subValue) {
                    return {
                        ...(subValue as NodePayload),
                        meta: { ...(subValue as NodePayload).meta, ...newMeta }
                    };
                }

                return {
                    ...resultPayload,
                    value: subValue,
                    meta: newMeta
                };
            }
        }

        return resultPayload;
    }

    public getEdges(): Edge[] {
        return this.state.edges;
    }

    public getNodesMap(): Map<string, NodeLogic> {
        return this.state.nodes;
    }

    public getNode(id: string): NodeLogic | undefined {
        return this.state.nodes.get(id);
    }

    // --- Public Actions (Phase 1.4) ---

    /** Flag to suppress useBrainSync during relink drag (prevents circular history corruption) */
    public isReconnecting = false;

    public moveNode(id: string, position: { x: number; y: number }, oldPosition?: { x: number; y: number }) {
        const node = this.state.nodes.get(id);
        // Optimization: Ignore micro-moves
        if (node && node.position && Math.abs(node.position.x - position.x) < 1 && Math.abs(node.position.y - position.y) < 1) {
            return;
        }

        this.applyTransaction({
            type: 'MOVE_NODE',
            payload: { id, position, oldPosition }
        });
    }


    // --- History Management (Rule #1) ---
    private history: HistoryManager = new HistoryManager();

    public undo() {
        const entry = this.history.undo();
        if (entry) {
            this.log(`Undoing: ${entry.undo.type}`);
            this.applyTransaction(entry.undo, false, true);
            this.emit('graphChanged', null);
        }
    }

    public redo() {
        const entry = this.history.redo();
        if (entry) {
            this.log(`Redoing: ${entry.do.type}`);
            this.applyTransaction(entry.do, false, true);
            this.emit('graphChanged', null);
        }
    }

    // --- Transaction Handling ---

    public applyTransaction(tx: Transaction, record: boolean = true, silent: boolean = false): { success: boolean; reason?: string } {
        if (record) {
            const inverseTx = this.createInverseTransaction(tx);
            if (inverseTx) {
                this.history.push({ do: tx, undo: inverseTx });
            }
        }

        switch (tx.type) {


            case 'ADD_NODE': {
                const p = tx.payload as AddNodePayload;
                // Payload: { id, initialValue, type, data }
                // Phase 2.1: Ensure initialValue is wrapped
                const initialPayload = PayloadUtils.wrap(p.initialValue);

                const newNode: NodeLogic = {
                    id: p.id,
                    type: p.type || 'baseNode',
                    value: initialPayload,
                    data: p.data || {},
                    position: p.position as { x: number; y: number },
                    isInDirtyChain: true
                };
                this.state.nodes.set(p.id, newNode);
                return { success: true };
            }

            case 'UPDATE_VALUE': {
                // Payload: { id, value }
                const p = tx.payload as UpdateValuePayload;
                const targetId = p.id;
                const rawValue = p.value;
                const node = this.state.nodes.get(targetId);

                if (node) {
                    // Phase 2.1: Wrap raw value into Payload
                    node.value = PayloadUtils.wrap(rawValue);
                    node.isInDirtyChain = false; // Input is fresh
                    this.worker.setFreshlyUpdated(targetId);
                    this.triggerDirtyChain(node.id);

                    if (!silent) this.triggerCalculation();
                    return { success: true };
                }
                return { success: false, reason: 'Node not found' };
            }

            case 'CONNECT': {
                const newEdge = tx.payload as Edge;
                const validation = this.validateConnection(
                    newEdge.source,
                    newEdge.sourceHandle,
                    newEdge.target,
                    newEdge.targetHandle,
                    this.state.edges
                );

                if (validation.isValid) {
                    this.state.edges.push(newEdge);
                    this.updateAdjacency(newEdge, 'ADD');
                    const tNode = this.state.nodes.get(newEdge.target);
                    if (tNode) tNode.isInDirtyChain = true;
                    this.triggerDirtyChain(newEdge.target);

                    // Phase 4.1: Track added edge for Worker
                    if (!this.pendingPatch.addedEdges) this.pendingPatch.addedEdges = [];
                    this.pendingPatch.addedEdges.push({
                        id: newEdge.id,
                        source: newEdge.source,
                        sourceHandle: newEdge.sourceHandle || '',
                        target: newEdge.target,
                        targetHandle: newEdge.targetHandle || '',
                    });

                    this.log(`Connected ${newEdge.source} -> ${newEdge.target}`);
                    if (!silent) {
                        this.emit('graphChanged', null);
                        this.triggerCalculation();
                    }
                    return { success: true };
                } else {
                    this.log(`Blocked: ${validation.reason}`);
                    return { success: false, reason: validation.reason };
                }
            }

            case 'REMOVE_NODE': {
                const id = tx.payload as string;
                if (!this.state.nodes.has(id)) return { success: false, reason: 'Node not found' };
                this.state.nodes.delete(id);
                const connectedEdges = this.state.edges.filter(e => e.source === id || e.target === id);
                connectedEdges.forEach(e => {
                    this.updateAdjacency(e, 'REMOVE');
                    if (e.target !== id) {
                        const tNode = this.state.nodes.get(e.target);
                        if (tNode) tNode.isInDirtyChain = true;
                        this.triggerDirtyChain(e.target);
                    }
                });
                this.state.edges = this.state.edges.filter(e => e.source !== id && e.target !== id);

                // Phase 4.1: Track removed node + edges for Worker
                if (!this.pendingPatch.removedNodeIds) this.pendingPatch.removedNodeIds = [];
                this.pendingPatch.removedNodeIds.push(id);
                if (!this.pendingPatch.removedEdgeIds) this.pendingPatch.removedEdgeIds = [];
                connectedEdges.forEach(e => this.pendingPatch.removedEdgeIds!.push(e.id));

                if (!silent) {
                    this.emit('graphChanged', null);
                    this.triggerCalculation();
                }
                return { success: true };
            }

            case 'DISCONNECT': {
                const edgeId = tx.payload as string;
                const edgeToRemove = this.state.edges.find(e => e.id === edgeId);
                if (edgeToRemove) {
                    this.updateAdjacency(edgeToRemove, 'REMOVE');
                    this.state.edges = this.state.edges.filter(e => e.id !== edgeId);
                    const tNode = this.state.nodes.get(edgeToRemove.target);
                    if (tNode) tNode.isInDirtyChain = true;
                    this.triggerDirtyChain(edgeToRemove.target);

                    // Phase 4.1: Track removed edge for Worker's shadow graph
                    if (!this.pendingPatch.removedEdgeIds) {
                        this.pendingPatch.removedEdgeIds = [];
                    }
                    this.pendingPatch.removedEdgeIds.push(edgeId);

                    if (!silent) {
                        this.emit('graphChanged', null);
                        this.triggerCalculation();
                    }
                    return { success: true };
                }
                return { success: false, reason: 'Edge not found' };
            }

            case 'MOVE_NODE': {
                const p = tx.payload as MoveNodePayload;
                const node = this.state.nodes.get(p.id);
                if (node) {
                    node.position = p.position;
                    if (!silent) this.emit('graphChanged', null);
                    return { success: true };
                }
                return { success: false, reason: 'Node not found' };
            }

            case 'UPDATE_NODE_DATA': {
                const p = tx.payload as { id: string, data: Record<string, unknown> };
                const tNode = this.state.nodes.get(p.id);
                if (tNode) {
                    tNode.data = { ...tNode.data, ...p.data };
                    tNode.isInDirtyChain = true;
                    this.triggerDirtyChain(tNode.id);

                    if (!silent) {
                        // 5. Success
                        this.emit('graphChanged', null); // Trigger full topology sync (Phase 2.3 Unit & Data Sync)
                        // RE-LAYOUT removed to prevent unwanted auto-layout on data change
                        this.triggerCalculation();
                    }
                    return { success: true };
                }
                return { success: false, reason: 'Node not found' };
            }

            case 'BATCH':
                (tx.payload as Transaction[]).forEach((t: Transaction) => {
                    this.applyTransaction(t, false, true);
                });
                this.emit('graphChanged', null);
                this.triggerCalculation();
                // Phase 4.1: BATCH transactions (undo/redo) → force full Worker sync
                if (this.worker.isEnabled()) {
                    this.syncWorker();
                }
                return { success: true };

            case 'REORDER_EDGES': {
                // Payload: string[] of edge IDs in the desired order
                const orderedIds = tx.payload as string[];
                const edgeMap = new Map(this.state.edges.map(e => [e.id, e]));
                const reordered: Edge[] = [];
                for (const eid of orderedIds) {
                    const edge = edgeMap.get(eid);
                    if (edge) reordered.push(edge);
                }
                // Append any edges not in the ordered list (safety net)
                for (const e of this.state.edges) {
                    if (!orderedIds.includes(e.id)) reordered.push(e);
                }
                this.state.edges = reordered;
                return { success: true };
            }

            default:
                return { success: false, reason: 'Unknown transaction type' };
        }
    }

    // --- Async Engine (Rule #4 & Protocol Law) ---

    private calculationTimeout: NodeJS.Timeout | null = null;
    private readonly DEBOUNCE_MS = 50;

    /**
     * @deprecated Use automatic metabolism (heartbeat).
     * This is now a no-op as the heartbeat handles calculation checks.
     */
    private triggerCalculation() {
        // Heartbed handles this automatically now.
    }

    // ... createInverseTransaction and validateConnection remain mostly unchanged logic ...
    // But verify they don't depend on 'value' internal structure deeply.
    // createInverseTransaction uses node.value, which is now NodePayload.
    // ADD_NODE transaction payload.initialValue will be NodePayload.
    // When re-applying ADD_NODE, PayloadUtils.wrap is idempotent, so it works.

    /**
     * Generates the inverse transaction for Undo.
     */
    private createInverseTransaction(tx: Transaction): Transaction | null {
        switch (tx.type) {
            case 'ADD_NODE':
                return { type: 'REMOVE_NODE', payload: (tx.payload as AddNodePayload).id };

            case 'REMOVE_NODE': {
                const id = tx.payload as string;
                const node = this.state.nodes.get(id);
                if (!node) return null;

                const addNodeTx: Transaction = {
                    type: 'ADD_NODE',
                    payload: {
                        id: node.id,
                        initialValue: node.value, // This is NodePayload
                        type: node.type,
                        data: { ...node.data },
                        position: node.position
                    }
                };

                const connectedEdges = this.state.edges.filter(
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
                const edge = this.state.edges.find(e => e.id === (tx.payload as string));
                if (!edge) return null;
                return { type: 'CONNECT', payload: { ...edge } };
            }

            case 'MOVE_NODE': {
                const p = tx.payload as MoveNodePayload;
                const node = this.state.nodes.get(p.id);
                if (!node) return null;
                const restorePos = p.oldPosition || node.position || { x: 0, y: 0 };

                return {
                    type: 'MOVE_NODE',
                    payload: {
                        id: node.id,
                        position: restorePos
                    }
                };
            }

            case 'UPDATE_NODE_DATA': {
                const p = tx.payload as { id: string, data: Record<string, unknown> };
                const node = this.state.nodes.get(p.id);
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
                    .map(t => this.createInverseTransaction(t))
                    .filter(t => t !== null)
                    .reverse() as Transaction[];

                return {
                    type: 'BATCH',
                    payload: inverses
                };
            }



            case 'UPDATE_VALUE': {
                // Inverse of value update is... restoring old value.
                // We need the OLD value to undo. 
                // Currently Transaction only has NEW value.
                // This is a known issue in my HistoryManager if we don't capture state *before* apply.
                // createInverseTransaction is called BEFORE apply, so node.value is OLD value.
                const p = tx.payload as UpdateValuePayload;
                const node = this.state.nodes.get(p.id);
                if (!node) return null;

                return {
                    type: 'UPDATE_VALUE',
                    payload: {
                        id: node.id,
                        value: node.value // This is the OLD value (NodePayload)
                        // Wait, applyTransaction for UPDATE_VALUE expects raw value or Payload?
                        // It wraps it via PayloadUtils.wrap().
                        // So passing NodePayload is fine (wrap is idempotent).
                    }
                };
            }

            default:
                return null;
        }
    }

    public validateConnection(
        source: string,
        sourceHandle: string | null | undefined,
        target: string,
        targetHandle: string | null | undefined,
        edges?: Edge[]
    ): { isValid: boolean; reason?: string } {

        const edgesToCheck = edges || this.state.edges;

        if (!source || !target || !sourceHandle || !targetHandle) {
            return { isValid: false, reason: 'Incomplete connection data' };
        }

        if (source === target) {
            return { isValid: false, reason: 'Cannot connect node to itself' };
        }

        if (!this.state.nodes.has(source) || !this.state.nodes.has(target)) {
            return { isValid: false, reason: 'Source or Target node does not exist' };
        }

        const getHandleType = (nodeId: string, handleId: string) => {
            const node = this.state.nodes.get(nodeId);
            if (!node) return null;

            // 1. Special Case: Vector Split (AD-09) mode-based swap
            // This MUST come before any pre-filled or static handle checks because AD-09 handles are dynamic.
            if (node.type === 'AD-09') {
                const op = String(node.data?.op || '').toUpperCase();
                const mode = (node.data?.mode || (op === 'COMBINE' ? 'combine' : 'separate')) as string;

                console.log(`[Brain] getHandleType for AD-09 (${node.id}): op=${op}, mode=${mode}, handle=${handleId}`);

                if (mode === 'combine' || op === 'COMBINE') {
                    if (['x', 'y', 'z'].includes(handleId)) return 'target';
                    if (handleId === 'out') return 'source';
                } else { // separate
                    if (handleId === 'in') return 'target';
                    if (['x', 'y', 'z'].includes(handleId)) return 'source';
                }
            }

            // 2. Check instance data for dynamically generated handles (SY-05, etc.)
            if (node.data && Array.isArray(node.data.handles)) {
                const handleFromData = node.data.handles.find((h: any) => h.id === handleId);
                if (handleFromData) return handleFromData.type;
            }

            // 3. Check Static Definition
            const def = NODE_DEFINITIONS.find(d => d.id === node.type);
            if (!def) return null;

            const handle = def.handles.find(h => h.id === handleId);
            return handle?.type || null;
        };

        const sourceHandleType = getHandleType(source, sourceHandle!);
        const targetHandleType = getHandleType(target, targetHandle!);

        // Fail-safe: if we can't find the definition, fallback to basic string check
        const isInput = (id: string, typeHint: string | null) => {
            if (typeHint) return typeHint === 'target';
            const lid = id.toLowerCase();
            return !!id && (lid.startsWith('in') || lid === 'target' || lid.includes('input') || lid === 'condition' || lid === 'select' || lid === 'data' || lid === 'if');
        };

        const sourceIsInput = isInput(sourceHandle!, sourceHandleType);
        const targetIsInput = isInput(targetHandle!, targetHandleType);

        if (sourceIsInput === targetIsInput) {
            // IF we still don't know for sure (both null handleType), and it's CGL injection, 
            // maybe we should be more lenient? No, let's fix the handle discovery.
            return { isValid: false, reason: `Invalid connectivity: ${source}:${sourceHandle}(${sourceHandleType}) -> ${target}:${targetHandle}(${targetHandleType})` };
        }

        const fromNode = sourceIsInput ? target : source;
        const toNode = sourceIsInput ? source : target;

        // Reactivate UI-level cycle prevention, since users usually don't intend to build infinite loops
        // and it's cleaner to reject it at connection time.
        if (this.detectCycle(fromNode, toNode, edgesToCheck)) {
            return { isValid: false, reason: 'Connection would create a cycle' };
        }

        const inputNodeId = sourceIsInput ? source : target;
        const inputHandleId = sourceIsInput ? sourceHandle : targetHandle;

        if (inputNodeId && inputHandleId) {
            const node = this.state.nodes.get(inputNodeId);
            const variant = getHandleVariant(node, inputHandleId);

            if (variant !== 'capsule') {
                const existingEdge = edgesToCheck.find(e =>
                    e.target === inputNodeId &&
                    e.targetHandle === inputHandleId
                );

                if (existingEdge) {
                    return { isValid: false, reason: 'Input already occupied' };
                }
            }
        }

        return { isValid: true };
    }

    private detectCycle(sourceNode: string, targetNode: string, edges: Edge[]): boolean {
        const graph = new Map<string, string[]>();

        for (const edge of edges) {
            if (!graph.has(edge.source)) {
                graph.set(edge.source, []);
            }
            graph.get(edge.source)?.push(edge.target);
        }

        const visited = new Set<string>();
        const stack = [targetNode];

        while (stack.length > 0) {
            const current = stack.pop()!;

            if (current === sourceNode) {
                return true;
            }

            if (!visited.has(current)) {
                visited.add(current);
                const neighbors = graph.get(current) || [];
                for (const neighbor of neighbors) {
                    stack.push(neighbor);
                }
            }
        }

        return false;
    }

    public toInjectable(): import('./types').InjectableGraph {
        const nodes = Array.from(this.state.nodes.values()).map(n => ({
            id: n.id,
            type: n.type || 'unknown',
            position: n.position || { x: 0, y: 0 },
            data: n.data,
            value: n.value
        }));

        const edges = this.state.edges.map(e => ({
            id: e.id,
            source: e.source,
            sourceHandle: e.sourceHandle || 'out',
            target: e.target,
            targetHandle: e.targetHandle || 'in'
        }));

        return { nodes, edges };
    }

    // --- On-Demand AST Generation (Phase 3 Foundation) ---

    /**
     * Recursive function to generate AST for a specific node.
     * This is cold-path logic (only runs when UI requests formula).
     */
    public getSymbol(nodeId: string): import('../types/payload').ASTNode | null {
        const node = this.state.nodes.get(nodeId);
        if (!node) {
            console.warn(`[Brain] getSymbol: Node ${nodeId} not found in state.`);
            return null;
        }
        console.log(`[Brain] getSymbol: Found node ${nodeId}, generating symbol...`);

        // 1. If node has a cached symbol, return it (e.g. Factor nodes might cache)
        if (node.value && node.value.symbol) {
            return node.value.symbol;
        }

        // 2. If no symbol, we must construct it from inputs
        const inputs = this.topology.getInputs(nodeId);
        const inputSymbols: Record<string, import('../types/payload').ASTNode> = {};

        // Recurse inputs
        for (const input of inputs) {
            const childSymbol = this.getSymbol(input.nodeId);
            if (childSymbol && input.targetHandle) {
                inputSymbols[input.targetHandle] = childSymbol;
            }
        }

        // 3. Ask Registry to construct AST using input symbols
        const result = NodeRegistry.getSymbol(node, inputSymbols);
        if (!result) {
            console.error(`[Brain] getSymbol: Registry returned null for node ${nodeId} (${node.type})`);
        }
        return result;
    }

    // --- Dev Tools ---

    public async injectNodes(graph: import('./types').InjectableGraph, clear: boolean = false, skipLayout: boolean = false): Promise<string[]> {
        this.log(`Injecting ${graph.nodes.length} nodes and ${graph.edges.length} edges...`);
        const diagnostics: string[] = [];
        const nodeTxs: Transaction[] = [];

        if (clear) {
            this.state.nodes.forEach(n => {
                nodeTxs.push({ type: 'REMOVE_NODE', payload: n.id });
            });
        }

        // 1. Add Nodes
        graph.nodes.forEach(n => {
            let nodeData = n.data || {};
            if (!nodeData.handles) {
                const def = NODE_DEFINITIONS.find(d => d.id === n.type);
                if (def && def.handles) {
                    nodeData = { ...nodeData, handles: def.handles };
                }
            }

            let initVal = n.value;
            if (initVal === undefined && n.data && n.data.value !== undefined) {
                if (n.type.startsWith('IO-')) {
                    initVal = n.data.value;
                }
            }

            nodeTxs.push({
                type: 'ADD_NODE',
                payload: {
                    id: n.id,
                    type: n.type,
                    position: n.position,
                    data: nodeData,
                    initialValue: initVal
                }
            });
        });

        // 2. Validate and Add Edges
        const edgeTxs: Transaction[] = [];
        graph.edges.forEach(e => {
            const edgePayload = {
                id: e.id,
                source: e.source,
                sourceHandle: e.sourceHandle,
                target: e.target,
                targetHandle: e.targetHandle,
                type: 'magnetic',
                data: { pathType: 'bezier', animate: false }
            } as unknown as Edge;

            edgeTxs.push({
                type: 'CONNECT',
                payload: edgePayload
            });
        });

        const allTxs = [...nodeTxs, ...edgeTxs];
        if (allTxs.length > 0) {
            // Pre-validation: Check for cycles across all intended connections
            // This prevents "Double-Link" or "Infinite Loop" traps during high-authority CGL import
            const virtualEdges = [...this.state.edges];
            for (const t of edgeTxs) {
                const e = t.payload as Edge;
                const validation = this.validateConnection(e.source, e.sourceHandle, e.target, e.targetHandle, virtualEdges);
                if (!validation.isValid) {
                    diagnostics.push(`Pre-validation failed: ${e.source} -> ${e.target} (${validation.reason})`);
                    // If we find a cycle in the incoming batch, we refuse to inject the edges
                    // to keep the brain clean.
                } else {
                    virtualEdges.push(e);
                }
            }

            if (diagnostics.some(d => d.includes('Pre-validation failed'))) {
                this.log(`Batch injection aborted due to validation errors.`);
                return diagnostics; // Return early without applying
            }

            // We use a custom BATCH apply to capture individual errors
            const tx = { type: 'BATCH' as const, payload: allTxs };

            // Generate inverse for the entire batch
            const inverseTx = this.createInverseTransaction(tx);
            if (inverseTx) {
                this.history.push({ do: tx, undo: inverseTx });
            }

            // Apply Nodes manually silently
            nodeTxs.forEach(t => this.applyTransaction(t, false, true));

            // Apply Edges manually and catch validation errors
            edgeTxs.forEach(t => {
                const res = this.applyTransaction(t, false, true);
                if (!res.success) {
                    const payload = t.payload as Edge;
                    diagnostics.push(`Failed to connect ${payload.source}:${payload.sourceHandle} to ${payload.target}:${payload.targetHandle} - ${res.reason}`);
                }
            });

            this.emit('graphChanged', null);
            this.triggerCalculation();
            if (!skipLayout) this.emit('RE-LAYOUT', null);

            // Phase 4.1: injectNodes = full graph change → force Worker sync
            if (this.worker.isEnabled()) {
                this.syncWorker();
            }
        }

        return diagnostics;
    }
}

