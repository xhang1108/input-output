/**
 * 🧠 Brain Web Worker
 * 
 * Runs the computation pipeline (NodeRegistry.evaluate + InputOutputEngine) in a
 * background thread. Maintains a persistent shadow graph that mirrors the
 * main-thread Brain state via incremental patches.
 * 
 * Phase 4.1: Web Worker Migration
 * 
 * IPC Protocol:
 *   INIT         → Bootstrap InputOutputEngine with shared MATH_CONFIG
 *   SYNC_GRAPH   → Full graph replacement (project load, crash recovery)
 *   EVAL         → Apply incremental patches + compute dirty nodes
 *   CLEAR_STATE  → Purge all internal state
 *   HEALTH_CHECK → Report node/edge counts + value hashes for validation
 */

import { create, all } from 'mathjs';
import { MATH_CONFIG } from './mathConfig';
import { NodeRegistry } from './NodeRegistry';
import { PayloadUtils } from '../utils/PayloadUtils';
import { NodePayload } from '../types/payload';
import type { NodeLogic } from './types';
import type {
    WorkerRequest,
    WorkerResponse,
    SerializedGraphSnapshot,
    SerializedNodeLogic,
    SerializedEdge,
    IncrementalPatch,
    SerializedPayload,
} from './SerializableGraph';
import deepEqual from 'fast-deep-equal';

// ─── Internal State ────────────────────────────────────────────────

let math: any = null;
let lastProcessedMsgId = -1;

/** Shadow graph: persistent node store */
let nodes: Map<string, NodeLogic> = new Map();
/** Shadow graph: persistent edge store */
let edges: SerializedEdge[] = [];
/** Adjacency index: source → targets[] */
let adjacency: Map<string, string[]> = new Map();
/** Reverse adjacency: target → inputs[] */
let reverseAdjacency: Map<string, { nodeId: string; sourceHandle: string; targetHandle: string }[]> = new Map();
// ─── Stack-based Context Management Removed ────────────────────────


// ─── Topology Helpers ──────────────────────────────────────────────

function rebuildAdjacency() {
    adjacency.clear();
    reverseAdjacency.clear();
    for (const edge of edges) {
        // Forward
        const targets = adjacency.get(edge.source) || [];
        targets.push(edge.target);
        adjacency.set(edge.source, targets);
        // Reverse
        const inputs = reverseAdjacency.get(edge.target) || [];
        inputs.push({
            nodeId: edge.source,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
        });
        reverseAdjacency.set(edge.target, inputs);
    }
}

function addEdge(edge: SerializedEdge) {
    edges.push(edge);
    const targets = adjacency.get(edge.source) || [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
    const inputs = reverseAdjacency.get(edge.target) || [];
    inputs.push({ nodeId: edge.source, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle });
    reverseAdjacency.set(edge.target, inputs);
}

function removeEdge(edgeId: string) {
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;
    edges = edges.filter(e => e.id !== edgeId);
    // Forward
    const targets = adjacency.get(edge.source) || [];
    const tIdx = targets.indexOf(edge.target);
    if (tIdx !== -1) targets.splice(tIdx, 1);
    // Reverse
    const inputs = reverseAdjacency.get(edge.target) || [];
    const iIdx = inputs.findIndex(i => i.nodeId === edge.source && i.sourceHandle === edge.sourceHandle && i.targetHandle === edge.targetHandle);
    if (iIdx !== -1) inputs.splice(iIdx, 1);
}

// ─── Graph Hydration ───────────────────────────────────────────────

function hydrateNode(sn: SerializedNodeLogic): NodeLogic {
    return {
        id: sn.id,
        type: sn.type,
        value: sn.value ? {
            type: sn.value.type,
            value: sn.value.value,
            symbol: sn.value.symbol,
            meta: sn.value.meta,
        } : undefined,
        data: sn.data || {},
        isInDirtyChain: sn.isInDirtyChain,
        position: { x: 0, y: 0 } // Position not needed for computation
    };
}

function loadSnapshot(snapshot: SerializedGraphSnapshot) {
    clearState();
    for (const sn of snapshot.nodes) {
        nodes.set(sn.id, hydrateNode(sn));
    }
    edges = [...snapshot.edges];
    rebuildAdjacency();
}

function clearState() {
    nodes.clear();
    edges = [];
    adjacency.clear();
    reverseAdjacency.clear();
}

// ─── Incremental Patch Application ────────────────────────────────

function applyPatch(patch: IncrementalPatch) {
    // 1. Remove nodes
    if (patch.removedNodeIds) {
        for (const id of patch.removedNodeIds) {
            nodes.delete(id);
            adjacency.delete(id);
            reverseAdjacency.delete(id);
        }
    }

    // 2. Remove edges
    if (patch.removedEdgeIds) {
        for (const edgeId of patch.removedEdgeIds) {
            removeEdge(edgeId);
        }
    }

    // 3. Add nodes
    if (patch.addedNodes) {
        for (const sn of patch.addedNodes) {
            nodes.set(sn.id, hydrateNode(sn));
        }
    }

    // 4. Add edges
    if (patch.addedEdges) {
        for (const edge of patch.addedEdges) {
            addEdge(edge);
        }
    }

    // 5. Update existing nodes (value/data changed)
    if (patch.updatedNodes) {
        for (const sn of patch.updatedNodes) {
            const existing = nodes.get(sn.id);
            if (existing) {
                existing.data = sn.data;
                if (sn.value) {
                    existing.value = {
                        type: sn.value.type,
                        value: sn.value.value,
                        symbol: sn.value.symbol,
                        meta: sn.value.meta,
                    };
                }
                existing.isInDirtyChain = sn.isInDirtyChain;
            }
        }
    }

    // 6. Mark dirty
    for (const id of patch.dirtyChainNodeIds) {
        const node = nodes.get(id);
        if (node) node.isInDirtyChain = true;
    }
}

// ─── Computation Pipeline ──────────────────────────────────────────

async function getValue(
    nodeId: string,
    sourceHandle?: string,
    computingPath: Set<string> = new Set()
): Promise<NodePayload> {
    const node = nodes.get(nodeId);
    if (!node) return PayloadUtils.createError(`Node ${nodeId} not found`);

    // Cycle detection
    if (computingPath.has(nodeId)) {
        return PayloadUtils.createError('Cycle Detected');
    }

    let resultPayload: NodePayload;

    if (!node.isInDirtyChain && node.value) {
        resultPayload = node.value;
    } else {
        const newPath = new Set(computingPath);
        newPath.add(nodeId);

        // --- Standard Node Logic ---

        const inputs = reverseAdjacency.get(nodeId) || [];
        const inputPayloads: Record<string, any> = {};

        for (const input of inputs) {
            const payload = await getValue(input.nodeId, input.sourceHandle, newPath);
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

        // Compute via NodeRegistry
        try {
            resultPayload = await NodeRegistry.evaluate(node, inputPayloads as any);
        } catch (error) {
            resultPayload = PayloadUtils.createError('Computation Failed');
        }

        const oldPayload = node.value;
        node.value = resultPayload;
        node.isInDirtyChain = false;

        // Stepwise propagation: mark children dirty only if value changed
        const changed = !oldPayload || !deepEqual(oldPayload, resultPayload);
        if (changed) {
            const children = adjacency.get(nodeId) || [];
            for (const childId of children) {
                const child = nodes.get(childId);
                if (child && !child.isInDirtyChain) {
                    child.isInDirtyChain = true;
                }
            }
        }
    }

    // Handle multi-output extraction
    if (sourceHandle && typeof resultPayload.value === 'object' && resultPayload.value !== null) {
        const multiValue = resultPayload.value as Record<string, unknown>;
        if (sourceHandle in multiValue) {
            const subValue = multiValue[sourceHandle];
            const parentMeta = resultPayload.meta || {};
            const handleMeta = parentMeta.handleMeta?.[sourceHandle] || {};
            const newMeta = { ...parentMeta, ...handleMeta };

            if (subValue && typeof subValue === 'object' && 'type' in subValue && 'value' in subValue) {
                return { ...(subValue as NodePayload), meta: { ...(subValue as NodePayload).meta, ...newMeta } };
            }
            return { ...resultPayload, value: subValue, meta: newMeta };
        }
    }

    return resultPayload;
}

async function computeDirtyChainNodes(): Promise<Record<string, SerializedPayload>> {
    const patches: Record<string, SerializedPayload> = {};

    // Loop until convergence: computing a node may dirty its children,
    // which need to be computed in the next pass
    let maxPasses = 20; // Safety limit to prevent infinite loops
    while (maxPasses-- > 0) {
        const dirtyChainNodeIds = Array.from(nodes.values())
            .filter(n => n.isInDirtyChain)
            .map(n => n.id);

        if (dirtyChainNodeIds.length === 0) break;

        for (const id of dirtyChainNodeIds) {
            const node = nodes.get(id);
            if (!node) continue;

            const newPayload = await getValue(id);
            // Dehydrate before sending back to main thread
            patches[id] = {
                type: newPayload.type,
                value: PayloadUtils.dehydrate(newPayload.value),
                symbol: PayloadUtils.dehydrate(newPayload.symbol) as import('../types/payload').ASTNode | null,
                meta: PayloadUtils.dehydrate(newPayload.meta) as Record<string, unknown>,
            };
        }
    }

    return patches;
}

// ─── Value Hash for HEALTH_CHECK ───────────────────────────────────

function hashNodeValue(nodeId: string): string {
    const node = nodes.get(nodeId);
    if (!node || !node.value) return 'null';
    try {
        return JSON.stringify(PayloadUtils.dehydrate(node.value.value)).substring(0, 64);
    } catch {
        return 'unhashable';
    }
}

// ─── Message Handler ───────────────────────────────────────────────

function respond(msg: WorkerResponse) {
    (self as unknown as { postMessage: (msg: WorkerResponse) => void }).postMessage(msg);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const msg = event.data;
    if ('msgId' in msg && msg.msgId <= lastProcessedMsgId) {
        return;
    }
    if ('msgId' in msg) {
        lastProcessedMsgId = msg.msgId;
    }

    switch (msg.type) {
        case 'INIT': {
            NodeRegistry.initializeNodes();
            math = create(all, msg.config);
            respond({ type: 'READY' });
            break;
        }

        case 'UPDATE_CONFIG': {
            math = create(all, msg.config);
            // Optionally, we could re-trigger evaluation of all dirty nodes here,
            // but usually the proxy will follow up with an EVAL if needed.
            respond({ type: 'READY' });
            break;
        }

        case 'SYNC_GRAPH': {
            loadSnapshot(msg.snapshot);
            respond({ type: 'READY' });
            break;
        }

        case 'EVAL': {
            try {
                applyPatch(msg.patches);
                const patches = await computeDirtyChainNodes();
                respond({ type: 'RESULT', epoch: msg.epoch, patches });
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                respond({ type: 'ERROR', epoch: msg.epoch, error: errMsg });
            }
            break;
        }

        case 'SYNC_AND_EVAL': {
            try {
                // 1. Full graph replacement
                loadSnapshot(msg.snapshot);
                // 2. Mark specified nodes dirty
                for (const id of msg.dirtyChainNodeIds) {
                    const node = nodes.get(id);
                    if (node) node.isInDirtyChain = true;
                }
                // 3. Compute
                const patches = await computeDirtyChainNodes();
                respond({ type: 'RESULT', epoch: msg.epoch, patches });
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                respond({ type: 'ERROR', epoch: msg.epoch, error: errMsg });
            }
            break;
        }

        case 'CLEAR_STATE': {
            clearState();
            respond({ type: 'READY' });
            break;
        }

        case 'HEALTH_CHECK': {
            const sampleHashes: Record<string, string> = {};
            if (msg.sampleNodeIds) {
                for (const id of msg.sampleNodeIds) {
                    sampleHashes[id] = hashNodeValue(id);
                }
            }
            respond({
                type: 'HEALTH',
                nodeCount: nodes.size,
                edgeCount: edges.length,
                sampleHashes,
            });
            break;
        }
    }
};
