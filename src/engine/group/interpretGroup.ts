import { DataType, type NodePayload, type PayloadMetadata } from '../../types/payload';
import type { GroupNodeData, SubGraph } from '../../types/groupNode';
import type { NodeLogic } from '../types/engineTypes';
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { getGroupPlan } from './planCache';

// P1 reference implementation (GROUP_NODE_PLAN §5.2, §7 D2/D7).
//
// The main graph treats `group` as one ordinary node: inputs arrive keyed by
// boundary portId, outputs return keyed by boundary portId. This interpreter
// topologically sorts the lean subGraph and evaluates each inner node exactly
// once via the shared NodeRegistry — the semantic baseline (and fallback) for
// the P2 compiled fast path. Both paths must agree (§8.4).

// D2: v1 nesting ban. A subGraph must never contain a frame or group node —
// undo / port-rewiring / IOGL costs triple with nesting. Rejected here, loudly.
const FORBIDDEN_INNER_TYPES = new Set(['group', 'frame']);

// §5.2: stateful sources are single-shot per group pass. The one sample is
// fanned out to every downstream consumer (frozen for the pass); inner nodes
// never join the main-graph dirty chain — only the group node itself does.
// A fresh group evaluation re-runs the subGraph (Timer re-reads its snapshot,
// Random re-rolls once).
const SINGLE_SHOT_TYPES = new Set(['IN-10', 'IN-11']);

export class GroupNestedError extends Error {
    public readonly nodeId: string;
    constructor(nodeId: string, type: string) {
        super(
            `[Group] D2 nesting rejected: inner node '${nodeId}' is type '${type}'. ` +
            `v1 groups cannot contain frame/group nodes.`
        );
        this.name = 'GroupNestedError';
        this.nodeId = nodeId;
    }
}

export class GroupCycleError extends Error {
    public readonly nodeIds: string[];
    constructor(nodeIds: string[]) {
        super(
            `[Group] Cycle detected in subGraph: ${nodeIds.join(' -> ')} -> ${nodeIds[0]}. ` +
            `Fix the inner wiring before grouping.`
        );
        this.name = 'GroupCycleError';
        this.nodeIds = nodeIds;
    }
}

/** Kahn's algorithm, stable in subGraph.nodes order. Throws GroupCycleError. */
export function topoSortSubGraph(subGraph: SubGraph): string[] {
    const ids = subGraph.nodes.map((n) => n.id);
    const inSet = new Set(ids);
    const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
    const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));

    for (const e of subGraph.edges) {
        if (!inSet.has(e.source) || !inSet.has(e.target)) continue; // dangling: skipped at eval
        if (e.source === e.target) {
            throw new GroupCycleError([e.source]);
        }
        outgoing.get(e.source)!.push(e.target);
        indegree.set(e.target, indegree.get(e.target)! + 1);
    }

    const queue = ids.filter((id) => indegree.get(id) === 0);
    const order: string[] = [];
    for (let head = 0; head < queue.length; head++) {
        const id = queue[head];
        order.push(id);
        for (const next of outgoing.get(id)!) {
            const remaining = indegree.get(next)! - 1;
            indegree.set(next, remaining);
            if (remaining === 0) queue.push(next);
        }
    }

    if (order.length !== ids.length) {
        throw new GroupCycleError(ids.filter((id) => indegree.get(id)! > 0));
    }
    return order;
}

/**
 * Mirror of Brain.getValue's handle extraction: a multi-output inner payload
 * stores per-handle sub-payloads under `value[handle]`.
 */
function extractInnerHandle(payload: NodePayload, handle: string): NodePayload {
    const value = payload?.value;
    if (value && typeof value === 'object' && value !== null && handle in (value as Record<string, unknown>)) {
        const sub = (value as Record<string, unknown>)[handle];
        if (sub && typeof sub === 'object' && 'type' in (sub as Record<string, unknown>) && 'value' in (sub as Record<string, unknown>)) {
            return sub as NodePayload;
        }
        // Inactive split branch (LG-03 emits null): collapse to a clean zero
        // at the group boundary instead of leaking null downstream.
        if (sub === null || sub === undefined) {
            return PayloadUtils.createScalar(0);
        }
        return PayloadUtils.wrap(sub);
    }
    return payload;
}

export async function interpretGroup(
    groupNode: NodeLogic,
    outerInputs: Record<string, NodePayload>
): Promise<NodePayload> {
    const data = (groupNode.data || {}) as Partial<GroupNodeData>;
    const subGraph: SubGraph = data.subGraph ?? { nodes: [], edges: [] };
    const boundary = data.boundary ?? { inputs: [], outputs: [] };

    // D2: reject nesting before doing any work.
    for (const node of subGraph.nodes) {
        if (FORBIDDEN_INNER_TYPES.has(node.type)) {
            throw new GroupNestedError(node.id, node.type);
        }
    }

    const { order, byId, incoming, portByTarget } = getGroupPlan(subGraph, boundary);

    // Boundary inputs feed inner handles that have NO inner edge (inner wiring
    // wins on conflict — a grouped port replaces, never duplicates, a wire).
    // portByTarget comes from the cached plan above.

    // incoming adjacency comes from the cached plan above (do NOT rebuild or
    // mutate it here — the plan is shared across evaluations).

    // Single sequential pass: every inner node — including SINGLE_SHOT_TYPES
    // (IN-10 Random, IN-11 Timer) — evaluates exactly once, so stateful values
    // are frozen and shared by all downstream consumers within this pass.
    void SINGLE_SHOT_TYPES;
    const results = new Map<string, NodePayload>();
    for (const id of order) {
        const lean = byId.get(id)!;
        const innerInputs: Record<string, NodePayload> = {};

        for (const e of incoming.get(id) ?? []) {
            const src = results.get(e.source);
            if (!src) continue; // dangling source: evaluator falls back to its default
            const payload = extractInnerHandle(src, e.sourceHandle);
            const key = e.targetHandle;
            // Capsule fan-in: mirror Brain.getValue's multi-payload accumulation.
            if (key in innerInputs) {
                const existing = innerInputs[key];
                innerInputs[key] = (Array.isArray(existing) ? [...existing, payload] : [existing, payload]) as unknown as NodePayload;
            } else {
                innerInputs[key] = payload;
            }
        }

        // Boundary feed for unconnected handles (outer edge, else D10 default).
        for (const [key, port] of portByTarget) {
            const sep = key.lastIndexOf('::');
            const targetId = key.slice(0, sep);
            const targetHandle = key.slice(sep + 2);
            if (targetId !== id || targetHandle in innerInputs) continue;
            const outer = outerInputs[port.portId];
            if (outer !== undefined) {
                innerInputs[targetHandle] = outer;
            } else if (port.defaultValue !== undefined) {
                innerInputs[targetHandle] = PayloadUtils.wrap(port.defaultValue);
            }
        }

        const innerNode = {
            id: lean.id,
            type: lean.type,
            data: (lean.data ?? {}) as Record<string, unknown>,
            position: lean.position,
            selected: false,
            isInDirtyChain: false,
        } as unknown as NodeLogic;
        results.set(id, await NodeRegistry.evaluate(innerNode, innerInputs, { skipSymbol: true }));
    }

    // Outputs return keyed by boundary portId — the same multi-output shape
    // (DataType.Object + handleMeta) that Brain.getValue extracts per handle.
    if ((boundary.outputs ?? []).length === 0) {
        return PayloadUtils.createError('Group has no boundary outputs');
    }
    const value: Record<string, unknown> = {};
    const handleMeta: Record<string, PayloadMetadata> = {};
    for (const port of boundary.outputs ?? []) {
        const produced = results.get(port.innerNodeId);
        if (!produced) {
            return PayloadUtils.createError(`Group output '${port.portId}' references missing node '${port.innerNodeId}'`);
        }
        const extracted = extractInnerHandle(produced, port.innerHandle);
        value[port.portId] = extracted;
        handleMeta[port.portId] = extracted.meta ?? {};
    }

    return { type: DataType.Object, value, symbol: null, meta: { handleMeta } };
}
