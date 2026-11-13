import type { Edge } from '@xyflow/react';

export type SlotEntry = { index: number; total: number };
export type SlotIndex = Map<string, SlotEntry>;

const cache = new WeakMap<readonly Edge[], SlotIndex>();

export function getEdgeSlotIndex(edges: readonly Edge[]): SlotIndex {
    const hit = cache.get(edges);
    if (hit) return hit;
    const built = buildEdgeSlotIndex(edges);
    cache.set(edges, built);
    return built;
}

export function buildEdgeSlotIndex(edges: readonly Edge[]): SlotIndex {
    const byKey = new Map<string, string[]>();
    for (const e of edges) {
        const key = `${e.target}\u0000${e.targetHandle ?? ''}`;
        const list = byKey.get(key);
        if (list) list.push(e.id);
        else byKey.set(key, [e.id]);
    }
    const out: SlotIndex = new Map();
    for (const ids of byKey.values()) {
        ids.forEach((id, index) => out.set(id, { index, total: ids.length }));
    }
    return out;
}
