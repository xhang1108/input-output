
import { Edge, Node } from '@xyflow/react';
import { GraphState, ComputationMode, NodeLogic, Transaction } from './types';
import { HistoryManager } from './HistoryManager';
import { NodePayload, DataType } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';
import { NodeRegistry } from './NodeRegistry'; // Static Import
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';

export class Brain {
    private static instance: Brain;
    private state: GraphState;

    // Topology Indices for O(1) lookups
    private adjacency: Map<string, string[]> = new Map(); // Source -> Targets[]
    private reverseAdjacency: Map<string, { nodeId: string, sourceHandle: string, targetHandle: string }[]> = new Map(); // Target -> Inputs[]

    private constructor() {
        this.state = {
            nodes: new Map(),
            edges: [],
            mode: 'scientific' // Default to Scientific (BigNumber)
        };
        this.startHeartbeat();
    }

    private listeners: Map<string, Set<(payload: any) => void>> = new Map();

    private isRecalculating = false;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_MS = 16; // ~60fps

    private startHeartbeat() {
        if (this.heartbeatInterval) return;

        this.heartbeatInterval = setInterval(async () => {
            if (this.isRecalculating) return;

            // Check if any node is dirty
            const hasDirty = Array.from(this.state.nodes.values()).some(n => n.isDirty);
            if (hasDirty) {
                this.isRecalculating = true;
                try {
                    const patches = await this.recalculateDirty();
                    if (patches.length > 0) {
                        this.emit('graphChanged', patches);
                    }
                } finally {
                    this.isRecalculating = false;
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

    public on(eventType: string, callback: (payload: any) => void): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)?.add(callback);

        // Return cleanup function
        return () => this.off(eventType, callback);
    }

    public off(eventType: string, callback: (payload: any) => void) {
        this.listeners.get(eventType)?.delete(callback);
    }

    private emit(eventType: string, payload: any) {
        const listeners = this.listeners.get(eventType);
        listeners?.forEach(cb => cb(payload));
    }

    private log(msg: string) {
        this.emit('log', msg);
    }

    // --- State Accessors ---

    public getMode(): ComputationMode {
        return this.state.mode;
    }

    // --- Topology Management ---

    private updateAdjacency(edge: Edge, action: 'ADD' | 'REMOVE') {
        // 1. Forward Adjacency (Source -> Targets)
        const targets = this.adjacency.get(edge.source) || [];
        if (action === 'ADD') {
            targets.push(edge.target);
            this.adjacency.set(edge.source, targets);
        } else {
            this.adjacency.set(edge.source, targets.filter(t => t !== edge.target));
        }

        // 2. Reverse Adjacency (Target -> Inputs)
        const inputs = this.reverseAdjacency.get(edge.target) || [];
        if (action === 'ADD') {
            inputs.push({ nodeId: edge.source, sourceHandle: edge.sourceHandle!, targetHandle: edge.targetHandle! });
            this.reverseAdjacency.set(edge.target, inputs);
        } else {
            this.reverseAdjacency.set(edge.target, inputs.filter(i => i.nodeId !== edge.source));
        }
    }

    // --- Pulse Engine (Dirty & Pull) ---

    // 1. Dirty Propagation (The Pulse Wave)
    private propagateDirty(startNodeId: string) {
        const queue = [startNodeId];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;

            const node = this.state.nodes.get(currentId);
            if (node) {
                node.isDirty = true;
            }

            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const children = this.adjacency.get(currentId) || [];
            for (const childId of children) {
                queue.push(childId);
            }
        }
    }

    public clearAll() {
        this.state = {
            nodes: new Map(),
            edges: [],
            mode: 'scientific'
        };
        this.adjacency = new Map();
        this.reverseAdjacency = new Map();
        this.history.clear();
        this.emit('graphChanged', null);
    }

    private markAllDirty() {
        this.state.nodes.forEach(node => {
            node.isDirty = true;
        });
    }

    // 2. Pull Evaluation (The Calculation)
    // Phase 2.1: Updated to return NodePayload
    public async getValue(nodeId: string, sourceHandle?: string): Promise<NodePayload> {
        const node = this.state.nodes.get(nodeId);
        if (!node) return PayloadUtils.createError('Node not found');

        let resultPayload: NodePayload;

        // 1. Get/Calculate the node's current value
        if (!node.isDirty) {
            resultPayload = node.value;
        } else {
            const inputs = this.reverseAdjacency.get(nodeId) || [];

            const inputPayloads: Record<string, NodePayload> = {};

            for (const input of inputs) {
                // Pass sourceHandle to ensure multi-output nodes work
                const payload = await this.getValue(input.nodeId, input.sourceHandle);

                if (input.targetHandle) {
                    inputPayloads[input.targetHandle] = payload;
                }
            }

            // Compute
            resultPayload = await this.computeNode(node, inputPayloads);

            // Update & Clean
            node.value = resultPayload;
            node.isDirty = false;
        }

        // 2. Handle specific Handle extraction (Phase 2.2 Multi-Output)
        // If node supports parallel outputs, resultPayload.value might be a Record<string, PayloadValue>
        if (sourceHandle && typeof resultPayload.value === 'object' && resultPayload.value !== null) {
            const multiValue = resultPayload.value as Record<string, any>;
            if (sourceHandle in multiValue) {
                // Return a sub-payload for this specific handle
                // We keep the same type/meta for now, or the evaluator should have structured it.
                // Ideally, if it's a multi-output node, resultPayload.value[handle] 
                // contains the raw value, but we might need to wrap it.
                // Let's assume for now the evaluator returns { [handle]: specificValue }
                const subValue = multiValue[sourceHandle];

                // Phase 2.4: Metadata Propagation & Handle Specifics
                const parentMeta = resultPayload.meta || {};
                const handleMeta = parentMeta.handleMeta?.[sourceHandle] || {};

                // Merge strategies:
                // 1. Parent meta provided basics (e.g. unit?)
                // 2. Handle meta provides specifics (e.g. range, unit) via overwrite
                const newMeta = { ...parentMeta, ...handleMeta };
                // Remove handleMeta from the child to keep it clean? Optional.

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
    private async recalculateDirty(): Promise<{ id: string, value: NodePayload }[]> {
        const patches: { id: string, value: NodePayload }[] = [];

        const dirtyNodeIds = Array.from(this.state.nodes.values())
            .filter(n => n.isDirty)
            .map(n => n.id);

        for (const id of dirtyNodeIds) {
            const node = this.state.nodes.get(id);
            if (!node) continue;

            // Trigger Pull
            const newPayload = await this.getValue(id);

            patches.push({
                id: id,
                value: newPayload
            });
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

        // Handle specific Handle extraction (Phase 2.2 Multi-Output)
        if (sourceHandle && resultPayload && typeof resultPayload.value === 'object' && resultPayload.value !== null) {
            const multiValue = resultPayload.value as Record<string, any>;
            if (sourceHandle in multiValue) {
                const subValue = multiValue[sourceHandle];
                const parentMeta = resultPayload.meta || {};
                const handleMeta = parentMeta.handleMeta?.[sourceHandle] || {};
                return {
                    ...resultPayload,
                    value: subValue,
                    meta: { ...parentMeta, ...handleMeta }
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

    public applyTransaction(tx: Transaction, record: boolean = true, silent: boolean = false): void {
        if (record) {
            const inverseTx = this.createInverseTransaction(tx);
            if (inverseTx) {
                this.history.push({ do: tx, undo: inverseTx });
            }
        }

        switch (tx.type) {
            case 'SET_MODE':
                this.state.mode = tx.payload;
                this.emit('modeChanged', this.state.mode);
                this.log(`Mode switched to ${tx.payload}`);
                this.markAllDirty();
                break;

            case 'ADD_NODE':
                // Payload: { id, initialValue, type, data }
                // Phase 2.1: Ensure initialValue is wrapped
                const initialPayload = PayloadUtils.wrap(tx.payload.initialValue);

                const newNode: NodeLogic = {
                    id: tx.payload.id,
                    type: tx.payload.type || 'baseNode',
                    value: initialPayload,
                    data: tx.payload.data || {},
                    position: tx.payload.position,
                    isDirty: true
                };
                this.state.nodes.set(tx.payload.id, newNode);
                this.adjacency.set(tx.payload.id, []);
                this.reverseAdjacency.set(tx.payload.id, []);
                break;

            case 'MOVE_NODE': {
                const node = this.state.nodes.get(tx.payload.id);
                if (node) {
                    node.position = tx.payload.position;
                }
                break;
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
                    this.propagateDirty(newEdge.target);

                    this.log(`Connected ${newEdge.source} -> ${newEdge.target}`);
                    if (!silent) {
                        this.emit('graphChanged', null);
                        this.triggerCalculation();
                    }
                } else {
                    this.log(`Blocked: ${validation.reason}`);
                }
                break;
            }

            case 'REMOVE_NODE':
                this.state.nodes.delete(tx.payload);
                const connectedEdges = this.state.edges.filter(e => e.source === tx.payload || e.target === tx.payload);
                connectedEdges.forEach(e => this.updateAdjacency(e, 'REMOVE'));
                this.state.edges = this.state.edges.filter(e => e.source !== tx.payload && e.target !== tx.payload);
                this.adjacency.delete(tx.payload);
                this.reverseAdjacency.delete(tx.payload);
                break;

            case 'DISCONNECT':
                const edgeToRemove = this.state.edges.find(e => e.id === tx.payload);
                if (edgeToRemove) {
                    this.updateAdjacency(edgeToRemove, 'REMOVE');
                    this.state.edges = this.state.edges.filter(e => e.id !== tx.payload);
                    this.propagateDirty(edgeToRemove.target);
                    if (!silent) {
                        this.emit('graphChanged', null);
                        this.triggerCalculation();
                    }
                }
                break;

            case 'UPDATE_VALUE':
                // Payload: { id, value }
                const targetId = tx.payload.id;
                const rawValue = tx.payload.value;
                const node = this.state.nodes.get(targetId);

                if (node) {
                    // Phase 2.1: Wrap raw value into Payload
                    // This handles Input nodes receiving numbers/strings from UI
                    node.value = PayloadUtils.wrap(rawValue);
                    node.isDirty = false; // Input is fresh
                    this.propagateDirty(node.id);

                    if (!silent) this.triggerCalculation();
                }
                break;

            case 'MOVE_NODE':
                const mNode = this.state.nodes.get(tx.payload.id);
                if (mNode) {
                    mNode.position = { ...tx.payload.position };
                    // No need to trigger calculation or emit 'graphChanged' for pure movement
                    // unless we want to sync positions to other clients or UI components.
                    // But useBrainUpdates listens to graphChanged even for position?
                    // Yes, useBrainUpdates syncs position if mismatch.
                    // So we SHOULD emit graphChanged if we want to confirm the move?
                    // Actually, if we don't emit, useBrainUpdates won't fire.
                    // But if we do emit, it might double-update?
                    // Safe bet: Emit so state is consistent.
                    if (!silent) this.emit('graphChanged', null);
                }
                break;

            case 'UPDATE_NODE_DATA':
                const tNode = this.state.nodes.get(tx.payload.id);
                if (tNode) {
                    tNode.data = { ...tNode.data, ...tx.payload.data };
                    tNode.isDirty = true;
                    this.propagateDirty(tNode.id);
                    this.log(`Updated Node Data ${tNode.id}`);

                    if (!silent) {
                        // 5. Success
                        this.emit('graphChanged', null); // Trigger full topology sync (Phase 2.3 Unit & Data Sync)
                        // RE-LAYOUT removed to prevent unwanted auto-layout on data change
                        this.triggerCalculation();
                    }
                }
                break;

            case 'BATCH':
                (tx.payload as Transaction[]).forEach(t => {
                    this.applyTransaction(t, false, true);
                });
                this.emit('graphChanged', null);
                this.triggerCalculation();
                break;
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
                return { type: 'REMOVE_NODE', payload: tx.payload.id };

            case 'REMOVE_NODE': {
                const node = this.state.nodes.get(tx.payload);
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
                    e => e.source === tx.payload || e.target === tx.payload
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
                const edge = this.state.edges.find(e => e.id === tx.payload);
                if (!edge) return null;
                return { type: 'CONNECT', payload: { ...edge } };
            }

            case 'MOVE_NODE': {
                const node = this.state.nodes.get(tx.payload.id);
                if (!node) return null;
                const restorePos = tx.payload.oldPosition || node.position || { x: 0, y: 0 };

                return {
                    type: 'MOVE_NODE',
                    payload: {
                        id: node.id,
                        position: restorePos
                    }
                };
            }

            case 'UPDATE_NODE_DATA': {
                const node = this.state.nodes.get(tx.payload.id);
                if (!node) return null;
                const oldData: any = {};
                for (const key in tx.payload.data) {
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

            case 'SET_MODE':
                return { type: 'SET_MODE', payload: this.state.mode };

            case 'UPDATE_VALUE': {
                // Inverse of value update is... restoring old value.
                // We need the OLD value to undo. 
                // Currently Transaction only has NEW value.
                // This is a known issue in my HistoryManager if we don't capture state *before* apply.
                // createInverseTransaction is called BEFORE apply, so node.value is OLD value.
                const node = this.state.nodes.get(tx.payload.id);
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
            return !!id && (id.toLowerCase().startsWith('in') || id === 'target' || id.includes('input') || id === 'condition' || id === 'select');
        };

        const sourceIsInput = isInput(sourceHandle!, sourceHandleType);
        const targetIsInput = isInput(targetHandle!, targetHandleType);

        if (sourceIsInput === targetIsInput) {
            return { isValid: false, reason: 'Must connect Output to Input' };
        }

        const fromNode = sourceIsInput ? target : source;
        const toNode = sourceIsInput ? source : target;

        if (this.detectCycle(fromNode, toNode, edgesToCheck)) {
            return { isValid: false, reason: 'Connection would create a cycle' };
        }

        const inputNodeId = sourceIsInput ? source : target;
        const inputHandleId = sourceIsInput ? sourceHandle : targetHandle;

        if (inputNodeId && inputHandleId) {
            const existingEdge = edgesToCheck.find(e =>
                e.target === inputNodeId &&
                e.targetHandle === inputHandleId
            );

            if (existingEdge) {
                return { isValid: false, reason: 'Input already occupied' };
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
        if (!node) return null;

        // 1. If node has a cached symbol, return it (e.g. Factor nodes might cache)
        if (node.value.symbol) {
            return node.value.symbol;
        }

        // 2. If no symbol, we must construct it from inputs
        const inputs = this.reverseAdjacency.get(nodeId) || [];
        const inputSymbols: Record<string, import('../types/payload').ASTNode> = {};

        // Recurse inputs
        for (const input of inputs) {
            const childSymbol = this.getSymbol(input.nodeId);
            if (childSymbol && input.targetHandle) {
                inputSymbols[input.targetHandle] = childSymbol;
            }
        }

        // 3. Ask Registry to construct AST using input symbols
        // We need a new Registry method: `getSymbol(nodeType, nodeData, inputSymbols)`
        // Or we can simple reuse `evaluate` but passing Symbols instead of values?
        // No, `evaluate` is for Values. We need a `symbolize` method in Registry.

        // For now, let's implement a basic default symbolizers here or in Registry.
        // Let's defer to Registry static method.
        return NodeRegistry.getSymbol(node, inputSymbols);
    }

    // --- Dev Tools ---

    public async injectNodes(graph: import('./types').InjectableGraph, clear: boolean = false): Promise<void> {
        this.log(`Injecting ${graph.nodes.length} nodes and ${graph.edges.length} edges...`);

        const txs: Transaction[] = [];

        if (clear) {
            // Basic clear implementation - simply remove all existing nodes
            this.state.nodes.forEach(n => {
                txs.push({ type: 'REMOVE_NODE', payload: n.id });
            });
        }

        // 1. Add Nodes
        // 1. Add Nodes
        graph.nodes.forEach(n => {
            let nodeData = n.data || {};

            // Fix: Ensure handles are populated from Definitions if missing in JSON
            if (!nodeData.handles) {
                const def = NODE_DEFINITIONS.find(d => d.id === n.type);
                if (def && def.handles) {
                    nodeData = { ...nodeData, handles: def.handles };
                }
            }

            // Fix: Fallback to data.value if initialValue is missing for IO nodes (Legacy JSON support)
            let initVal = n.value;
            if (initVal === undefined && n.data && n.data.value !== undefined) {
                // Heuristic: If it has data.value and is IO/Logic-Source, treat as scalar/boolean
                if (n.type.startsWith('IO-') || n.type === 'MA-08' || n.type === 'MA-09') {
                    // For now, assume scalar. Logic nodes (MA-08) handle boolean conversion in their evaluator/wrapping if needed.
                    // PayloadUtils.wrap will handle number/boolean correctly.
                    // But we need to construct a raw value to be wrapped by ADD_NODE handlers, or pass a Payload directly?
                    // ADD_NODE wraps it: const initialPayload = PayloadUtils.wrap(tx.payload.initialValue);
                    // so we can pass the raw number/boolean.
                    initVal = n.data.value;
                }
            }

            txs.push({
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

        // 2. Add Edges (Wrapped in CONNECT transactions)
        graph.edges.forEach(e => {
            // Construct a valid Edge object for the transaction payload
            // We need to ensure it matches the Edge interface expected by CONNECT
            const edgePayload = {
                id: e.id,
                source: e.source,
                sourceHandle: e.sourceHandle,
                target: e.target,
                targetHandle: e.targetHandle,
                type: 'magnetic', // Default to magnetic
                data: { pathType: 'bezier', animate: false } // Default styling
            } as any; // Cast because Edge might have more specific XYFlow properties we don't have here

            txs.push({
                type: 'CONNECT',
                payload: edgePayload
            });
        });

        if (txs.length > 0) {
            this.applyTransaction({ type: 'BATCH', payload: txs });
            // Emit RE-LAYOUT to signal UI to run layout on the newly injected topology
            this.emit('RE-LAYOUT', null);
        }
    }
}

