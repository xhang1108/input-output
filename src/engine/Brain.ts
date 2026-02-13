
import { Edge, Node } from '@xyflow/react';
import { GraphState, ComputationMode, NodeLogic, Transaction } from './types';
import { HistoryManager } from './HistoryManager';

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
        console.log(`[Brain] Listener added for ${eventType}. Total: ${this.listeners.get(eventType)?.size}`);

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
        // Emit log event instead of direct calling
        this.emit('log', msg);
    }

    // Deprecated: use on('modeChanged', ...)
    // Keeping for temporary compat if needed, but better to remove to force refactor
    // public subscribe(...) 


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

            // Should we mark startNode dirty? 
            // If it's an INPUT node receiving a value, it's NOT dirty (it has the value).
            // If it's a Logic node, it IS dirty.
            if (currentId !== startNodeId) {
                const node = this.state.nodes.get(currentId);
                if (node) {
                    node.isDirty = true;
                    // Optional: emit event for UI debug
                }
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
    public getValue(nodeId: string): any {
        const node = this.state.nodes.get(nodeId);
        if (!node) return 0;

        // If clean, return cache
        if (!node.isDirty) {
            return node.value;
        }

        // If dirty, calculate!
        const inputs = this.reverseAdjacency.get(nodeId) || [];
        const inputValues: Record<string, any> = {};

        for (const input of inputs) {
            const val = this.getValue(input.nodeId);
            if (input.targetHandle) {
                inputValues[input.targetHandle] = val;
            }
        }

        // Compute
        const result = this.computeNode(node, inputValues);

        // Update & Clean
        node.value = result;
        node.isDirty = false;

        return result;
    }

    /**
     * Recalculates all dirty nodes in the graph.
     * Use topological sort or simple iteration?
     * Since getValue is recursive/memoized (Pull), we just need to trigger it on all nodes?
     * Actually, if we just call getValue on all nodes, it works.
     * But better: call getValue on nodes that are dirty?
     * Yes.
     */
    private async recalculateDirty(): Promise<any[]> {
        const patches: any[] = [];

        // We iterate specifically over dirty nodes? 
        // Or just all nodes?
        // If we iterate all nodes and call getValue, it resolves via recursion.
        // But we want to know which ones *actually* updated to send patches.

        // Strategy:
        // 1. Snapshot dirty state? No, just iterate.
        // 2. For each node, if dirty:
        //    a. Get old value (if we tracked it) -> Actually we don't store old value strictly, just current.
        //    b. Call getValue() -> updates node.value
        //    c. Add { id, value } to patches.

        // Issue: recursing calls getValue() on inputs first. 
        // Those inputs might be dirty too. They get updated & cleaned.
        // When we later iterate to that input node, it is now CLEAN.
        // So we won't add it to patches if we check `isDirty` inside the loop *after* it was cleaned by a child?
        // NO.

        // Correct Approach:
        // Identify ALL currently dirty nodes into a set.
        const dirtyNodeIds = Array.from(this.state.nodes.values())
            .filter(n => n.isDirty)
            .map(n => n.id);

        for (const id of dirtyNodeIds) {
            const node = this.state.nodes.get(id);
            if (!node) continue;

            // If it's already clean (because a downstream node pulled it), we still want to report its new value?
            // Yes, because UI needs to know it changed.
            // But if it was clean *before* we started? No.
            // It WAS dirty at start of pulse.

            const newValue = this.getValue(id); // This might trigger computation if still dirty.

            // We should ideally check if value DIFFERENT from pre-computation?
            // For now, assume if it was dirty, we send update.
            patches.push({
                id: id,
                value: newValue
            });
        }

        return patches;
    }

    // 3. Primitve Node Registry (Placeholder for Phase 2)
    private computeNode(node: NodeLogic, inputs: Record<string, any>): any {
        // Dynamic import to avoid circular dependency issues during this phase
        // in a real setup we'd import at top, but NodeRegistry might need types from here?
        // Actually types are in types.ts, so it should be fine.
        // But for safety in this tool execution:
        const { NodeRegistry } = require('./NodeRegistry');
        return NodeRegistry.evaluate(node, inputs);
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
        // Optimization: Check if position actually changed?
        // The UI might send same position on click-release.
        const node = this.state.nodes.get(id);
        if (node && node.position && Math.abs(node.position.x - position.x) < 1 && Math.abs(node.position.y - position.y) < 1) {
            return; // Ignore micro-moves
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
            // Apply the UNDO transaction, but DO NOT record it in history again!
            this.applyTransaction(entry.undo, false, true);
            // Force Reflow (Topology Change)
            this.emit('graphChanged', null);
        }
    }

    public redo() {
        const entry = this.history.redo();
        if (entry) {
            this.log(`Redoing: ${entry.do.type}`);
            // Apply the DO transaction without recording (already in history)
            this.applyTransaction(entry.do, false, true);
            // Force Reflow (Topology Change)
            this.emit('graphChanged', null);
        }
    }

    // --- Transaction Handling ---

    public applyTransaction(tx: Transaction, record: boolean = true, silent: boolean = false): void {
        // Record History (if enabled)
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
                const newNode: NodeLogic = {
                    id: tx.payload.id,
                    type: tx.payload.type || 'baseNode',
                    value: tx.payload.initialValue,
                    data: tx.payload.data || {},
                    position: tx.payload.position, // Phase 1.4: Validation of position
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
                    // Position change doesn't strictly make it dirty for calculation, 
                    // unless we have spatial nodes. For now, just update state.
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

                    // Update Indices
                    this.updateAdjacency(newEdge, 'ADD');
                    // Mark Target Dirty
                    this.propagateDirty(newEdge.target);

                    this.log(`Connected ${newEdge.source} -> ${newEdge.target}`);
                    if (!silent) this.emit('graphChanged', null);
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
                    if (!silent) this.emit('graphChanged', null);
                }
                break;

            case 'UPDATE_VALUE':
                // Payload: { id, value }
                const node = this.state.nodes.get(tx.payload.id);
                if (node) {
                    node.value = tx.payload.value;
                    node.isDirty = false; // Input is fresh
                    this.propagateDirty(node.id); // Propagate changes

                    // Rule #4: Debounce Calculation
                    if (!silent) this.triggerCalculation();
                }
                break;

            case 'UPDATE_NODE_DATA':
                // Payload: { id, data: Partial<NodeData> }
                const targetNode = this.state.nodes.get(tx.payload.id);
                if (targetNode) {
                    targetNode.data = { ...targetNode.data, ...tx.payload.data };
                    // Changing config (like Op) makes node dirty
                    targetNode.isDirty = true;
                    this.propagateDirty(targetNode.id);
                    this.log(`Updated Node Data ${targetNode.id}`);

                    // Rule #4: Debounce Calculation
                    if (!silent) this.triggerCalculation();
                }
                break;

            case 'BATCH':
                (tx.payload as Transaction[]).forEach(t => {
                    this.applyTransaction(t, false, true); // Don't record sub-transactions, Silent
                });
                // Force Update after batch
                this.emit('graphChanged', null);
                this.triggerCalculation();
                break;
        }
    }

    // --- Async Engine (Rule #4 & Protocol Law) ---

    private calculationTimeout: NodeJS.Timeout | null = null;
    private readonly DEBOUNCE_MS = 50; // Rule #4

    private triggerCalculation() {
        if (this.calculationTimeout) {
            clearTimeout(this.calculationTimeout);
        }

        this.calculationTimeout = setTimeout(async () => {
            const patches = await this.recalculateDirty();
            if (patches.length > 0) {
                this.emit('graphChanged', patches); // Send patches!
            }
        }, this.DEBOUNCE_MS);
    }

    /**
     * Generates the inverse transaction for Undo.
     * Must be called BEFORE the transaction is applied (Pre-mutation state).
     */
    private createInverseTransaction(tx: Transaction): Transaction | null {
        switch (tx.type) {
            case 'ADD_NODE':
                return { type: 'REMOVE_NODE', payload: tx.payload.id };

            case 'REMOVE_NODE': {
                // Need to restore the node AND its connected edges.
                // createInverseTransaction is called BEFORE mutation, so edges still exist.
                const node = this.state.nodes.get(tx.payload);
                if (!node) return null; // Can't undo removal of non-existent node

                const addNodeTx: Transaction = {
                    type: 'ADD_NODE',
                    payload: {
                        id: node.id,
                        initialValue: node.value,
                        type: node.type,
                        data: { ...node.data }, // Clone data
                        position: node.position // Restore position
                    }
                };

                // Capture connected edges (they will be cascade-deleted with the node)
                const connectedEdges = this.state.edges.filter(
                    e => e.source === tx.payload || e.target === tx.payload
                );

                if (connectedEdges.length === 0) {
                    return addNodeTx;
                }

                // BATCH: first add node, then reconnect all edges
                return {
                    type: 'BATCH',
                    payload: [
                        addNodeTx,
                        ...connectedEdges.map(e => ({
                            type: 'CONNECT' as const,
                            payload: { ...e } // Clone edge
                        }))
                    ]
                };
            }

            case 'CONNECT':
                return { type: 'DISCONNECT', payload: (tx.payload as Edge).id };

            case 'DISCONNECT': {
                const edge = this.state.edges.find(e => e.id === tx.payload);
                if (!edge) return null;
                return { type: 'CONNECT', payload: { ...edge } }; // Clone edge
            }

            case 'MOVE_NODE': {
                const node = this.state.nodes.get(tx.payload.id);
                if (!node) return null;
                // Inverse is moving back to old position
                // Use explicit oldPosition if provided (more reliable), else current state
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

            default:
                return null;
        }
    }


    /**
     * Validates a potential connection.
     * Can be used statically (helper) or via instance (using internal state if edges not provided).
     * 
     * @param source Source Node ID
     * @param sourceHandle Source Handle ID
     * @param target Target Node ID
     * @param targetHandle Target Handle ID
     * @param edges (Optional) Edges to check against. If omitted, uses Brain's internal state.
     */
    public validateConnection(
        source: string,
        sourceHandle: string | null | undefined,
        target: string,
        targetHandle: string | null | undefined,
        edges?: Edge[]
    ): { isValid: boolean; reason?: string } {

        const edgesToCheck = edges || this.state.edges;

        // DEBUG LOGGING
        // console.log(`[Brain] Validate: ${source}:${sourceHandle} -> ${target}:${targetHandle}`);

        // 1. Basic Existence Check
        if (!source || !target || !sourceHandle || !targetHandle) {
            return { isValid: false, reason: 'Incomplete connection data' };
        }

        // 2. Self-Loop Guard
        if (source === target) {
            return { isValid: false, reason: 'Cannot connect node to itself' };
        }

        // 3. Type Compatibility (Input/Output Direction)
        const isInput = (id: string) =>
            // Handle null/undefined gracefully
            !!id && (id.toLowerCase().startsWith('in') || id === 'target' || id.includes('input'));

        const sourceIsInput = isInput(sourceHandle);
        const targetIsInput = isInput(targetHandle);

        if (sourceIsInput === targetIsInput) {
            return { isValid: false, reason: 'Must connect Output to Input' };
        }

        // 4. Anti-Cycle Check (DFS)
        const fromNode = sourceIsInput ? target : source;
        const toNode = sourceIsInput ? source : target;

        if (this.detectCycle(fromNode, toNode, edgesToCheck)) {
            return { isValid: false, reason: 'Connection would create a cycle' };
        }

        return { isValid: true };
    }

    /**
     * Detects if there is a path from `startNode` to `targetNode` using existing edges.
     */
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
}
