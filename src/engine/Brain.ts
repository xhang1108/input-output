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
import { TransactionManager } from './TransactionManager';
import { PHYSICS_CONFIG } from './physicsConfig';
import deepEqual from 'fast-deep-equal';

export class Brain {
    private static instances: Map<string, Brain> = new Map();
    private state: GraphState;
    private id: string;

    private topology: TopologyManager;
    private worker: WorkerOrchestrator;
    private transactionManager: TransactionManager;

    private heartbeatInterval: NodeJS.Timeout | null = null;
    private visualTick: number = 0;
    private readonly HEARTBEAT_MS = 16.67;
    private pendingPatch: IncrementalPatch = { dirtyChainNodeIds: [] };
    private dirtyNodes: Set<string> = new Set();

    private constructor(id: string) {
        this.id = id;
        this.state = {
            nodes: new Map(),
            edges: [],
        };

        // Ensure nodes are registered
        NodeRegistry.initializeNodes();

        this.topology = new TopologyManager();
        this.worker = new WorkerOrchestrator({
            onResults: (patches, latency) => {
                this.applyWorkerResults(patches);
                useAppStore.getState().setLastEvalMs(latency);
            },
            onTriggerDirty: (id) => this.triggerDirtyChain(id),
            syncRequester: () => this.syncWorker(),
            emit: (ev, p) => {
                this.emit(ev, p);
                if (ev === 'workerError') {
                    this.isRecalculating = false;
                    this.pendingPatch = { dirtyChainNodeIds: [] }; // Clear pending patch on crash
                    console.warn('[Brain] Released recalculating lock due to Worker crash');
                }
            }
        });

        this.transactionManager = new TransactionManager();

        // Worker is lazily initialized on first heartbeat that needs it
        this.startHeartbeat();
    }

    private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();

    private isRecalculating = false;


    /** Apply Worker-computed results back into main-thread state */
    private applyWorkerResults(patches: Map<string, NodePayload>) {
        for (const [id, payload] of patches) {
            const node = this.state.nodes.get(id);
            if (node) {
                node.value = payload;
                node.isInDirtyChain = false;
                this.dirtyNodes.delete(id);
            }
        }
        this.isRecalculating = false;

        // ── Edge Signal Flow: Mark edges as active if their source node has valid data ──
        if (patches.size > 0) {
            let edgesUpdated = false;
            const updatedEdges = this.state.edges.map(edge => {
                const sourceNode = this.state.nodes.get(edge.source);
                if (!sourceNode) return edge;

                // Active = source node has a non-error result AND is not muted
                const isMuted = !!sourceNode.data?.muted;
                const hasValue = sourceNode.value && sourceNode.value.type !== 'error';
                const active = !isMuted && !!hasValue;

                // Only create new object if active state changed (avoid unnecessary re-renders)
                const currentActive = edge.data?.active;
                if (currentActive === active) return edge;

                edgesUpdated = true;
                return {
                    ...edge,
                    data: { ...edge.data, active },
                };
            });
            if (edgesUpdated) {
                this.state.edges = updatedEdges;
                this.emit('edgesChanged', null);
            }
        }

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

        // SSR/Build Guard: Never start heartbeats in Node.js environment during build
        const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
        if (typeof window === 'undefined' && !isTest) return;

        this.heartbeatInterval = setInterval(async () => {
            // 1. Global Visual Tick
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            this.visualTick = Math.floor(now / 16.67) % 10000;

            // 1.5 Sync visual state to all nodes for SSOT consistency (Spinal Reflex)
            for (const node of this.state.nodes.values()) {
                if (!node.visualState) {
                    node.visualState = { muted: false, visualTick: 0 };
                }
                node.visualState.muted = !!node.data?.muted;
                node.visualState.visualTick = this.visualTick;
            }

            if (!this.isRecalculating) {
                this.emit('visualUpdate', this.visualTick);
            }

            if (this.isRecalculating) return;

            // O(1) dirty check
            const hasDirty = this.dirtyNodes.size > 0 || this.worker.getFreshlyUpdated().size > 0;
            if (hasDirty) {
                this.isRecalculating = true;

                if (this.worker.isEnabled()) {
                    await this.worker.init();
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


    /** Force reset the heartbeat (Testing only) */
    public resetHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.visualTick = 0;
        this.startHeartbeat();
    }

    public getVisualTick() {
        return this.visualTick;
    }

    public getPhysicsConfig() {
        return PHYSICS_CONFIG;
    }

    public static getComputeSession(id: string = 'main'): Brain {
        if (!Brain.instances.has(id)) {
            Brain.instances.set(id, new Brain(id));
        }
        return Brain.instances.get(id)!;
    }

    /** Legacy alias for the main compute session */
    public static getInstance(): Brain {
        return this.getComputeSession('main');
    }

    /** 
     * Completely destroys this brain instance, cleaning up all intervals, 
     * workers, and listeners. 
     */
    public dispose() {
        // 1. Stop Heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        // 2. Shut down Worker
        this.worker.dispose();

        // 3. Clear Listeners
        this.listeners.clear();

        // 4. Reset State
        this.state = { nodes: new Map(), edges: [] };
        this.topology.clear();
        this.dirtyNodes.clear();

        // 5. Remove from instances map
        Brain.instances.delete(this.id);

        console.log(`[Brain] Session "${this.id}" disposed.`);
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
        // Sync the Set with any nodes the topology manager might have marked
        for (const [id, node] of this.state.nodes) {
            if (node.isInDirtyChain) this.dirtyNodes.add(id);
        }
    }

    public clearAll() {
        this.state = {
            nodes: new Map(),
            edges: [],
        };
        this.topology.clear();
        this.transactionManager.clearHistory();
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
            if (oldPayload && !deepEqual(oldPayload, resultPayload)) {
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
        console.log('[Brain] recalculateDirtyChain, useWorker:', this.worker.useWorker, 'hasProxy:', !!this.worker.workerProxy);

        if (this.worker.useWorker && this.worker.workerProxy) {
            console.log('[Brain] Requesting worker EVAL');
            const workerPatches = await this.worker.workerProxy.evaluate();
            // Assuming workerPatches is already a Map<string, NodePayload> or similar
            // If it's an array of objects, you might need to convert it.
            // For now, let's assume it's directly usable to populate `patches`.
            workerPatches.forEach((payload: NodePayload, id: string) => {
                patches.set(id, payload);
                const node = this.state.nodes.get(id);
                if (node) {
                    node.value = payload;
                    node.isInDirtyChain = false;
                }
            });
            return patches; // Exit early if worker handles evaluation
        }

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

    /** Flag to suppress useBrainSync MOVE_NODE/RESIZE_NODE during undo/redo (prevents Brain position being overwritten by stale React Flow state) */
    public isUndoing = false;

    /** Flag to suppress useBrainSync UPDATE_NODE_DATA during an active resize drag.
     * Set to true in onResizeStart, false after onResizeEnd commits the atomic BATCH.
     * Prevents the intermediate updateNodeData calls from polluting history. */
    public isResizing = false;

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

    public resizeNode(id: string, width: number, height: number, oldSize?: { width: number; height: number }) {
        this.applyTransaction({
            type: 'RESIZE_NODE',
            payload: { id, width, height, oldSize }
        });
    }


    // --- History Management (Rule #1) ---
    public undo() {
        this.isUndoing = true;
        try {
            this.transactionManager.undo((tx, record, silent) => this.applyTransaction(tx, record, silent));
            this.emit('graphChanged', null);
        } finally {
            // Reset flag after a short delay so useBrainUpdates can finish its sync
            // before useBrainSync processes the resulting React Flow node changes
            setTimeout(() => { this.isUndoing = false; }, 50);
        }
    }

    public redo() {
        this.isUndoing = true;
        try {
            this.transactionManager.redo((tx, record, silent) => this.applyTransaction(tx, record, silent));
            this.emit('graphChanged', null);
        } finally {
            setTimeout(() => { this.isUndoing = false; }, 50);
        }
    }

    // --- Transaction Handling ---

    public applyTransaction(tx: Transaction, record: boolean = true, silent: boolean = false): { success: boolean; reason?: string } {
        if (record) {
            const inverseTx = this.transactionManager.createInverseTransaction(tx, this.state);
            this.transactionManager.recordTransaction(tx, inverseTx);
        }

        const res = this.transactionManager.applyTransaction(tx, this.state, {
            onNodeAdded: (node) => {
                // Initial creation does not need to immediately trigger dirty chain 
                // because it has no inputs. It evaluates on next heartbeat.
            },
            onEdgeAdded: (edge) => {
                this.updateAdjacency(edge, 'ADD');
                const tNode = this.state.nodes.get(edge.target);
                if (tNode) tNode.isInDirtyChain = true;
                this.triggerDirtyChain(edge.target);

                if (!this.pendingPatch.addedEdges) this.pendingPatch.addedEdges = [];
                this.pendingPatch.addedEdges.push({
                    id: edge.id,
                    source: edge.source,
                    sourceHandle: edge.sourceHandle || '',
                    target: edge.target,
                    targetHandle: edge.targetHandle || '',
                });

                this.log(`Connected ${edge.source} -> ${edge.target}`);
            },
            onNodeRemoved: (id, cascadeEdges) => {
                cascadeEdges.forEach(e => {
                    this.updateAdjacency(e, 'REMOVE');
                    if (e.target !== id) {
                        const tNode = this.state.nodes.get(e.target);
                        if (tNode) tNode.isInDirtyChain = true;
                        this.triggerDirtyChain(e.target);
                    }
                });

                if (!this.pendingPatch.removedNodeIds) this.pendingPatch.removedNodeIds = [];
                this.pendingPatch.removedNodeIds.push(id);
                if (!this.pendingPatch.removedEdgeIds) this.pendingPatch.removedEdgeIds = [];
                cascadeEdges.forEach(e => this.pendingPatch.removedEdgeIds!.push(e.id));
            },
            onEdgeRemoved: (edgeToRemove) => {
                this.updateAdjacency(edgeToRemove, 'REMOVE');
                const tNode = this.state.nodes.get(edgeToRemove.target);
                if (tNode) tNode.isInDirtyChain = true;
                this.triggerDirtyChain(edgeToRemove.target);

                if (!this.pendingPatch.removedEdgeIds) {
                    this.pendingPatch.removedEdgeIds = [];
                }
                this.pendingPatch.removedEdgeIds.push(edgeToRemove.id);
            },
            onNodeDataUpdated: (id) => {
                this.worker.setFreshlyUpdated(id);
                this.triggerDirtyChain(id);
            },
            onNodeMoved: (id) => { },
            onGraphChanged: () => {
                if (!silent) this.emit('graphChanged', null);
            },
            onLog: (msg) => this.log(msg),
            validateConnection: (edge) => this.validateConnection(
                edge.source, edge.sourceHandle, edge.target, edge.targetHandle, this.state.edges
            )
        });

        if (res.success && !silent) {
            this.emit('graphChanged', null);

            // Layout Authority: refresh engine-side bounding box cache after structural changes
            const layoutTriggers: Set<string> = new Set(['ADD_NODE', 'RESIZE_NODE', 'MOVE_NODE', 'BATCH']);
            if (layoutTriggers.has(tx.type)) {
                this.refreshBoundingBoxes();
            }

            if (tx.type === 'BATCH' && this.worker.isEnabled()) {
                this.syncWorker();
            }
        }

        return res;
    }

    public validateConnection(
        source: string,
        sourceHandle: string | null | undefined,
        target: string,
        targetHandle: string | null | undefined,
        edges?: Edge[],
        nodesMap?: Map<string, NodeLogic>
    ): {
        isValid: boolean;
        reason?: string;
        normalized?: { source: string, sourceHandle: string, target: string, targetHandle: string }
    } {

        const edgesToCheck = edges || this.state.edges;
        const nodesToCheck = nodesMap || this.state.nodes;

        if (!source || !target || !sourceHandle || !targetHandle) {
            return { isValid: false, reason: 'Incomplete connection data' };
        }

        if (source === target) {
            return { isValid: false, reason: 'Cannot connect node to itself' };
        }

        if (!nodesToCheck.has(source) || !nodesToCheck.has(target)) {
            return { isValid: false, reason: 'Source or Target node does not exist' };
        }

        const getHandleType = (nodeId: string, handleId: string) => {
            const node = nodesToCheck.get(nodeId);
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

            // 3. SPECIAL: Expert Nodes (SY-05) dynamically bind any unknown name as target
            if (node.type === 'SY-05') {
                if (handleId === 'out') return 'source';
                return 'target';
            }

            // 4. Check Static Definition
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
            // IF we still don't know for sure (both null handleType), and it's IOGL injection,
            // maybe we should be more lenient? No, let's fix the handle discovery.
            return { isValid: false, reason: `Invalid connectivity: ${source}:${sourceHandle}(${sourceHandleType}) -> ${target}:${targetHandle}(${targetHandleType})` };
        }

        const fromNode = sourceIsInput ? target : source;
        const fromHandle = sourceIsInput ? targetHandle : sourceHandle;
        const toNode = sourceIsInput ? source : target;
        const toHandle = sourceIsInput ? sourceHandle : targetHandle;

        // Reactivate UI-level cycle prevention, since users usually don't intend to build infinite loops
        // and it's cleaner to reject it at connection time.
        if (this.detectCycle(fromNode, toNode, edgesToCheck)) {
            return { isValid: false, reason: 'Connection would create a cycle' };
        }

        const inputNodeId = sourceIsInput ? source : target;
        const inputHandleId = sourceIsInput ? sourceHandle : targetHandle;

        if (inputNodeId && inputHandleId) {
            const node = nodesToCheck.get(inputNodeId);
            const variant = getHandleVariant(node, inputHandleId);

            if (variant !== 'capsule') {
                const existing = edgesToCheck.find(e => e.target === inputNodeId && e.targetHandle === inputHandleId);
                if (existing) {
                    return { isValid: false, reason: 'Handle already connected' };
                }
            }
        }

        return {
            isValid: true,
            normalized: {
                source: fromNode,
                sourceHandle: fromHandle!,
                target: toNode,
                targetHandle: toHandle!
            }
        };
    }

    private detectCycle(sourceNode: string, targetNode: string, edges: Edge[]): boolean {
        const graph = new Map<string, string[]>();
        for (const edge of edges) {
            if (!graph.has(edge.source)) {
                graph.set(edge.source, []);
            }
            graph.get(edge.source)!.push(edge.target);
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
            value: n.value,
            parentId: n.parentId // Phase 4.1: Top-level parent tracking
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

    // --- Tree & Coordinate Utilities ---

    /**
     * Calculates the absolute position of a node by traversing its parent tree.
     */
    public getAbsolutePosition(nodeId: string): { x: number; y: number } {
        const node = this.state.nodes.get(nodeId);
        if (!node) return { x: 0, y: 0 };

        if (!node.parentId) {
            return { x: node.position.x, y: node.position.y };
        }

        const parentAbs = this.getAbsolutePosition(node.parentId);
        const parentNode = this.state.nodes.get(node.parentId);

        // Frames in Input-Output are centered on their position.
        // Nested children positions are relative to the parent's top-left.
        const pw = Number(parentNode?.data?.width ?? 0);
        const ph = Number(parentNode?.data?.height ?? 0);

        return {
            x: parentAbs.x - pw / 2 + node.position.x,
            y: parentAbs.y - ph / 2 + node.position.y
        };
    }

    /**
     * Returns all direct children of a given parent node.
     */
    public getChildren(parentId: string): NodeLogic[] {
        return Array.from(this.state.nodes.values()).filter(n => n.parentId === parentId);
    }

    // --- UI → Engine Bounding Box Channel ---

    /**
     * Updates the cached bounding box of a node from UI measurements.
     *
     * Called by `useContentMetrics` (ResizeObserver bridge) when a node's DOM
     * dimensions change due to content reflow (e.g. Sticky Note text growth).
     *
     * ⚠️ Pure metadata write — no Transaction, no Undo history, no dirty-chain.
     * This is intentional: bounding box is a geometric read-only cache for A* routing.
     */
    public updateNodeBoundingBox(id: string, box: { width: number; height: number }) {
        const node = this.state.nodes.get(id);
        if (!node) return;
        const abs = this.getAbsolutePosition(id);
        node.boundingBox = { width: box.width, height: box.height, x: abs.x, y: abs.y };
    }

    /**
     * Returns the last UI-reported bounding box for a node (absolute canvas coords).
     * Used by A* routing to know the current physical extent of each node.
     * Returns null if no measurement has been written yet.
     */
    public getNodeBoundingBox(id: string): { width: number; height: number; x: number; y: number } | null {
        return this.state.nodes.get(id)?.boundingBox ?? null;
    }

    // --- Layout Authority ---

    /**
     * Computes a best-effort bounding box for a node without relying on the DOM.
     * Priority: UI-reported boundingBox > data.width/height > nodeDefinitions minWidth/minHeight.
     * Returns null if no usable dimension information is available.
     */
    public computeBoundingBox(
        id: string
    ): { x: number; y: number; width: number; height: number } | null {
        const node = this.state.nodes.get(id);
        if (!node) return null;

        // 1. UI has already reported a fresh measurement — trust it (highest fidelity)
        if (node.boundingBox) return { ...node.boundingBox };

        const abs = this.getAbsolutePosition(id);

        // 2. User has manually resized — data.width/height persisted to store
        const dataW = typeof node.data.width === 'number' ? node.data.width : null;
        const dataH = typeof node.data.height === 'number' ? node.data.height : null;
        if (dataW !== null && dataH !== null) {
            return { x: abs.x, y: abs.y, width: dataW, height: dataH };
        }

        // 3. Fall back to nodeDefinitions minWidth/minHeight
        const def = NODE_DEFINITIONS.find(d => d.id === node.type);
        if (def?.minWidth && def?.minHeight) {
            return { x: abs.x, y: abs.y, width: def.minWidth, height: def.minHeight };
        }

        return null;
    }

    /**
     * Recomputes the engine-side boundingBox cache for ALL nodes that don't yet
     * have a UI-reported measurement. Called after structural transactions.
     * Does NOT overwrite boxes already reported by the UI (UI beats Engine).
     */
    private refreshBoundingBoxes(): void {
        for (const [id, node] of this.state.nodes) {
            // Skip nodes already measured by UI (highest fidelity — do not overwrite)
            if (node.boundingBox) continue;

            const computed = this.computeBoundingBox(id);
            if (computed) {
                node.boundingBox = computed;
            }
        }
    }



    public async injectNodes(
        graph: import('./types').InjectableGraph,
        clear: boolean = false,
        skipLayout: boolean = false,
        onProgress?: (processed: number, total: number) => void
    ): Promise<string[]> {
        this.log(`Injecting ${graph.nodes.length} nodes and ${graph.edges.length} edges...`);
        const diagnostics: string[] = [];
        const nodeTxs: Transaction[] = [];

        // Phase 5.3: Atomic Clear BEFORE validation
        if (clear) {
            this.silentReset();
        }

        // 1. Add Nodes
        graph.nodes.forEach(n => {
            let nodeData = n.data || {};
            const definition = NODE_DEFINITIONS.find(d => d.id === n.type);

            if (definition) {
                // Node Data Reconciliation: Sync with current code base definition
                
                // 1.1 Handles Sync: Prioritize definition's handles to ensure new IO ports appear
                if (definition.handles) {
                    nodeData = { ...nodeData, handles: definition.handles };
                }

                // 1.2 Parameters Sync: Backfill missing default parameters from definition
                if (definition.defaultData) {
                    for (const [key, value] of Object.entries(definition.defaultData)) {
                        // We only fill if the key is MISSING in saved data.
                        // This preserves user-set values (like Slider's current value) while adding new structural keys.
                        if (nodeData[key] === undefined) {
                            nodeData[key] = value;
                        }
                    }
                }
            } else {
                // Fallback for custom/legacy handles if no definition found
                if (!nodeData.handles) {
                    // This case is unlikely given the workflow, but kept for robustness
                    console.warn(`[Brain] No definition found for node type: ${n.type}. Using saved handles.`);
                }
            }

            let initVal = n.value;
            if (initVal === undefined && n.data && n.data.value !== undefined) {
                if (n.type.startsWith('IO-')) {
                    initVal = n.data.value;
                }
            }

            // Phase 4.1: Migrate legacy data.parentId to top-level parentId
            let parentId = n.parentId;
            if (!parentId && n.data && n.data.parentId) {
                parentId = n.data.parentId as string;
            }

            nodeTxs.push({
                type: 'ADD_NODE',
                payload: {
                    id: n.id,
                    type: n.type,
                    position: n.position,
                    data: nodeData,
                    initialValue: initVal,
                    parentId: parentId
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
            // This prevents "Double-Link" or "Infinite Loop" traps during high-authority IOGL import
            const virtualEdges = clear ? [] : [...this.state.edges];
            const virtualNodes = clear ? new Map<string, NodeLogic>() : new Map(this.state.nodes);

            // Populate virtual nodes
            graph.nodes.forEach(n => {
                virtualNodes.set(n.id, {
                    id: n.id,
                    type: n.type,
                    data: n.data || {},
                    position: n.position,
                    parentId: n.parentId
                } as NodeLogic);
            });

            for (const t of edgeTxs) {
                const e = t.payload as Edge;
                const validation = this.validateConnection(e.source, e.sourceHandle, e.target, e.targetHandle, virtualEdges, virtualNodes);
                if (!validation.isValid) {
                    diagnostics.push(`Pre-validation failed: ${e.source} -> ${e.target} (${validation.reason})`);
                    // If we find a cycle in the incoming batch, we refuse to inject the edges
                    // to keep the brain clean.
                } else {
                    virtualEdges.push(e);
                }
            }

            if (diagnostics.some(d => d.includes('Pre-validation failed'))) {
                this.log(`Batch injection proceeding with ${edgeTxs.length - diagnostics.length} valid edges (Skipped ${diagnostics.length} invalid connections).`);
            }

            const startTime = performance.now();

            // We use a custom BATCH apply to capture individual errors
            const tx = { type: 'BATCH' as const, payload: allTxs };

            // Generate inverse for the entire batch
            const inverseTx = this.transactionManager.createInverseTransaction(tx, this.state);
            this.transactionManager.recordTransaction(tx, inverseTx);

            // Helper to yield control to the browser for a paint
            const yieldToPaint = () => new Promise(r => {
                if (typeof requestAnimationFrame !== 'undefined') {
                    requestAnimationFrame(() => setTimeout(r, 0));
                } else {
                    setTimeout(r, 0); // Fallback for Node/Vitest environments
                }
            });

            const totalTxs = nodeTxs.length + edgeTxs.length;
            let processed = 0;
            const CHUNK_SIZE = 50;

            // Apply Nodes manually silently in chunks
            for (let i = 0; i < nodeTxs.length; i += CHUNK_SIZE) {
                const chunk = nodeTxs.slice(i, i + CHUNK_SIZE);
                chunk.forEach(t => this.applyTransaction(t, false, true));
                processed += chunk.length;

                if (onProgress) onProgress(processed, totalTxs);

                // Re-enable incremental rendering every 2 chunks (100 nodes) 
                // to prevent massive single render cycle at the end
                if (i > 0 && (i / CHUNK_SIZE) % 2 === 0) {
                    this.emit('graphChanged', null);
                }

                // Force a browser paint so the user sees the progress bar moving
                await yieldToPaint();
            }

            // Apply Edges manually and catch validation errors in chunks
            for (let i = 0; i < edgeTxs.length; i += CHUNK_SIZE) {
                const chunk = edgeTxs.slice(i, i + CHUNK_SIZE);
                chunk.forEach(t => {
                    const res = this.applyTransaction(t, false, true);
                    if (!res.success) {
                        const payload = t.payload as Edge;
                        diagnostics.push(`Failed to connect ${payload.source}:${payload.sourceHandle} to ${payload.target}:${payload.targetHandle} - ${res.reason}`);
                    }
                });
                processed += chunk.length;

                if (onProgress) onProgress(processed, totalTxs);

                if (i > 0 && (i / CHUNK_SIZE) % 2 === 0) {
                    this.emit('graphChanged', null);
                }

                await yieldToPaint();
            }

            // Single final emission after background processing completes
            this.emit('graphChanged', null);
            // Phase 4.3: Conditional Auto-Layout
            // Massive graphs > 100 nodes skip auto-layout to prevent ELK from freezing the UI for seconds.
            const shouldAutoLayout = !skipLayout && graph.nodes.length <= 100;
            if (shouldAutoLayout) {
                this.emit('RE-LAYOUT', null);
            } else if (graph.nodes.length > 100) {
                diagnostics.push(`[Performance] Auto-layout skipped for ${graph.nodes.length} nodes to prevent UI freeze. Use 'L' to layout manually.`);
            }

            // Phase 4.1: injectNodes = full graph change → force Worker sync
            if (this.worker.isEnabled()) {
                this.syncWorker();
            }

            const endTime = performance.now();
            this.emit('importFinished', Math.round(endTime - startTime));
        }

        return diagnostics;
    }

    // --- Future-Proof API Aliases (MASTER_TODO §1.2) ---

    /** Recalculates all dirty nodes in the graph (Alias for recalculateDirtyChain) */
    public async evaluate(): Promise<Map<string, NodePayload>> {
        return this.recalculateDirtyChain();
    }

    /** Gets the value of a specific node (Alias for getValue) */
    public async solve(nodeId: string): Promise<NodePayload> {
        return this.getValue(nodeId);
    }

    /** Injects nodes into the graph (Alias for injectNodes) */
    public async import(
        graph: import('./types').InjectableGraph,
        clear: boolean = false,
        onProgress?: (processed: number, total: number) => void
    ): Promise<string[]> {
        return this.injectNodes(graph, clear, false, onProgress);
    }
}


