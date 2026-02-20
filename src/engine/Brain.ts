import { NodePayload } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';
import { Edge } from '@xyflow/react';
import { GraphState, NodeLogic, Transaction, AddNodePayload, MoveNodePayload, UpdateValuePayload } from './types';
import { HistoryManager } from './HistoryManager';
import { NodeRegistry } from './NodeRegistry'; // Static Import
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';

export class Brain {
    // Phase 2.0.5: Forced Rebuild
    private static instance: Brain;
    private state: GraphState;

    // Topology Indices for O(1) lookups
    private adjacency: Map<string, string[]> = new Map(); // Source -> Targets[]
    private reverseAdjacency: Map<string, { nodeId: string, sourceHandle: string, targetHandle: string }[]> = new Map(); // Target -> Inputs[]

    private constructor() {
        this.state = {
            nodes: new Map(),
            edges: [],

        };
        this.startHeartbeat();
    }

    private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();

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
                    if (patches.size > 0) {
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
        if (!node.isDirty && node.value) {
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
    private async recalculateDirty(): Promise<Map<string, NodePayload>> {
        const patches = new Map<string, NodePayload>();

        const dirtyNodeIds = Array.from(this.state.nodes.values())
            .filter(n => n.isDirty)
            .map(n => n.id);

        for (const id of dirtyNodeIds) {
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
                    isDirty: true
                };
                this.state.nodes.set(p.id, newNode);
                this.adjacency.set(p.id, []);
                this.reverseAdjacency.set(p.id, []);
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
                    // This handles Input nodes receiving numbers/strings from UI
                    node.value = PayloadUtils.wrap(rawValue);
                    node.isDirty = false; // Input is fresh
                    this.propagateDirty(node.id);

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
                    this.propagateDirty(newEdge.target);

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
                connectedEdges.forEach(e => this.updateAdjacency(e, 'REMOVE'));
                this.state.edges = this.state.edges.filter(e => e.source !== id && e.target !== id);
                this.adjacency.delete(id);
                this.reverseAdjacency.delete(id);
                return { success: true };
            }

            case 'DISCONNECT': {
                const edgeId = tx.payload as string;
                const edgeToRemove = this.state.edges.find(e => e.id === edgeId);
                if (edgeToRemove) {
                    this.updateAdjacency(edgeToRemove, 'REMOVE');
                    this.state.edges = this.state.edges.filter(e => e.id !== edgeId);
                    this.propagateDirty(edgeToRemove.target);
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
                    tNode.isDirty = true;
                    this.propagateDirty(tNode.id);

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
                (tx.payload as Transaction[]).forEach(t => {
                    this.applyTransaction(t, false, true);
                });
                this.emit('graphChanged', null);
                this.triggerCalculation();
                return { success: true };

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
        const result = NodeRegistry.getSymbol(node, inputSymbols);
        if (!result) {
            console.error(`[Brain] getSymbol: Registry returned null for node ${nodeId} (${node.type})`);
        }
        return result;
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
                // Heuristic: If it has data.value and is IO family, treat as raw value
                if (n.type.startsWith('IO-')) {
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
            } as unknown as Edge; // Cast because Edge might have more specific XYFlow properties we don't have here

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

