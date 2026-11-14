import type { BoundaryPort, GroupNodeData, SubGraph } from '../../types/groupNode';
import { topoSortSubGraph } from './interpretGroup';
import {
    buildScopeParams,
    canCompileGroup,
    computeStructHash,
    type CompileCheck,
} from './compileGroup';

// Hot-path plan cache (P4 follow-up).
//
// interpretGroup / evaluateGroupCompiled used to redo O(N+E) work on every
// evaluation: topoSort, canCompile scan, structHash, buildScopeParams.
// Groups are committed (not edited) far more often than they are rebuilt,
// and our transaction layer replaces data.subGraph/boundary objects on edit
// (never mutates in place) — so object identity is a sound cache key with
// free invalidation. Edit paths that mutate in place MUST NOT exist; the
// composite BATCH in useGroupActions always assigns fresh objects, and the
// PATCH_SUBGRAPH diff-inverse path allocates fresh nodes/edges arrays plus a
// fresh data object for the same reason.
export interface GroupPlan {
    order: string[];
    byId: Map<string, SubGraph['nodes'][number]>;
    incoming: Map<string, SubGraph['edges']>;
    portByTarget: Map<string, BoundaryPort>;
    structHash: string;
    compilable: CompileCheck;
    params: Record<string, unknown>;
}

interface CacheEntry {
    subGraph: SubGraph;
    boundary: GroupNodeData['boundary'];
    plan: GroupPlan;
}

const cache = new WeakMap<object, CacheEntry>();

/** Deterministic proof for perf tests: how many plans were built. */
export const __testStats = { planBuilds: 0 };
export function clearPlanCacheStats() {
    __testStats.planBuilds = 0;
}

export function getGroupPlan(
    subGraph: SubGraph,
    boundary: GroupNodeData['boundary'],
): GroupPlan {
    const hit = cache.get(subGraph as object);
    if (hit && hit.boundary === boundary) return hit.plan;

    __testStats.planBuilds++;
    const order = topoSortSubGraph(subGraph);
    const byId = new Map(subGraph.nodes.map((n) => [n.id, n]));
    const incoming = new Map<string, SubGraph['edges']>();
    for (const e of subGraph.edges) {
        if (!byId.has(e.source) || !byId.has(e.target)) continue;
        const list = incoming.get(e.target) ?? [];
        list.push(e);
        incoming.set(e.target, list);
    }
    const portByTarget = new Map<string, BoundaryPort>();
    for (const port of boundary.inputs ?? []) {
        const key = `${port.innerNodeId}::${port.innerHandle}`;
        if (!portByTarget.has(key)) portByTarget.set(key, port);
    }
    const plan: GroupPlan = {
        order,
        byId,
        incoming,
        portByTarget,
        structHash: computeStructHash(subGraph, boundary),
        compilable: canCompileGroup(subGraph, boundary),
        params: buildScopeParams(subGraph, boundary),
    };
    cache.set(subGraph as object, { subGraph, boundary, plan });
    return plan;
}
