
import { Edge, Node } from '@xyflow/react';
import { GraphState, ComputationMode, NodeLogic, Transaction } from './types';
import { HistoryManager } from './HistoryManager';
import { NodePayload, DataType } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';
import { NodeRegistry } from './NodeRegistry'; // Static Import

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
    }

    private listeners: Map<string, Set<(payload: any) => void>> = new Map();

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

    private markAllDirty() {
        this.state.nodes.forEach(node => {
            node.isDirty = true;
        });
    }

    // 2. Pull Evaluation (The Calculation)
    // Phase 2.1: Updated to return NodePayload
    public getValue(nodeId: string): NodePayload {
        const node = this.state.nodes.get(nodeId);
        if (!node) return PayloadUtils.createError('Node not found');

        // If clean, return cache (NodeLogic.value is now NodePayload)
        if (!node.isDirty) {
            return node.value;
        }

        // If dirty, calculate!
        const inputs = this.reverseAdjacency.get(nodeId) || [];
        const inputPayloads: Record<string, NodePayload> = {};

        for (const input of inputs) {
            const payload = this.getValue(input.nodeId);

            // Phase 2.1: Error Propagation (Railroad)
            if (PayloadUtils.isType(payload, DataType.Error)) {
                // If any input is error, propagate it (unless node handles errors?)
                // For now, propagate.
                // We could potentially just pass it to computeNode and let logic decide.
                // But fast-fail is better for most nodes.
                // inputPayloads[input.targetHandle!] = payload;
            }

            if (input.targetHandle) {
                inputPayloads[input.targetHandle] = payload;
            }
        }

        // Compute
        const resultPayload = this.computeNode(node, inputPayloads);

        // Update & Clean
        node.value = resultPayload;
        node.isDirty = false;

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
            const newPayload = this.getValue(id);

            patches.push({
                id: id,
                value: newPayload
            });
        }

        return patches;
    }

    // 3. Primitve Node Registry
    private computeNode(node: NodeLogic, inputs: Record<string, NodePayload>): NodePayload {
        // Use Registry for evaluation
        // This decouples specific node logic from the Brain
        try {
            return NodeRegistry.evaluate(node, inputs);
        } catch (error) {
            console.error(`Error computing node ${node.id}:`, error);
            return PayloadUtils.createError('Computation Failed');
        }
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

            case 'UPDATE_NODE_DATA':
                const tNode = this.state.nodes.get(tx.payload.id);
                if (tNode) {
                    tNode.data = { ...tNode.data, ...tx.payload.data };
                    tNode.isDirty = true;
                    this.propagateDirty(tNode.id);
                    this.log(`Updated Node Data ${tNode.id}`);

                    if (!silent) {
                        this.emit('graphChanged', null); // Force full sync (Phase 2.3 Unit & Data Sync)
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

    private triggerCalculation() {
        if (this.calculationTimeout) {
            clearTimeout(this.calculationTimeout);
        }

        this.calculationTimeout = setTimeout(async () => {
            const patches = await this.recalculateDirty();
            if (patches.length > 0) {
                this.emit('graphChanged', patches);
            }
        }, this.DEBOUNCE_MS);
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

        const isInput = (id: string) =>
            !!id && (id.toLowerCase().startsWith('in') || id === 'target' || id.includes('input'));

        const sourceIsInput = isInput(sourceHandle);
        const targetIsInput = isInput(targetHandle);

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
}

