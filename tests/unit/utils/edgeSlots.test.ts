import type { Edge } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { buildEdgeSlotIndex, getEdgeSlotIndex } from '@/utils/edgeSlots';

function bruteForce(edges: readonly Edge[]): Map<string, { index: number; total: number }> {
    const out = new Map<string, { index: number; total: number }>();
    for (const e of edges) {
        const siblings = edges.filter((o) => o.target === e.target && o.targetHandle === e.targetHandle);
        out.set(e.id, { index: siblings.findIndex((s) => s.id === e.id), total: siblings.length });
    }
    return out;
}

function randomEdges(n: number, seed: number): Edge[] {
    let s = seed;
    const rnd = () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
    const edges: Edge[] = [];
    for (let i = 0; i < n; i++) {
        const t = `n${Math.floor(rnd() * 20)}`;
        const h = rnd() < 0.7 ? 'in_a' : `in_${Math.floor(rnd() * 3)}`;
        edges.push({ id: `e${i}`, source: `s${Math.floor(rnd() * 20)}`, target: t, targetHandle: h } as Edge);
    }
    return edges;
}

describe('edgeSlots S4', () => {
    it('matches brute-force O(n^2) oracle', () => {
        const edges = randomEdges(500, 42);
        const fast = buildEdgeSlotIndex(edges);
        const slow = bruteForce(edges);
        expect(fast.size).toBe(slow.size);
        for (const [id, v] of slow) {
            expect(fast.get(id)).toEqual(v);
        }
    });

    it('is order-stable: array order defines index, never sorted', () => {
        const base: Edge[] = [
            { id: 'a', source: 'x', target: 'T', targetHandle: 'h' } as Edge,
            { id: 'b', source: 'y', target: 'T', targetHandle: 'h' } as Edge,
            { id: 'c', source: 'z', target: 'T', targetHandle: 'h' } as Edge,
        ];
        const idx = buildEdgeSlotIndex(base);
        expect(idx.get('a')).toEqual({ index: 0, total: 3 });
        expect(idx.get('b')).toEqual({ index: 1, total: 3 });
        expect(idx.get('c')).toEqual({ index: 2, total: 3 });
        // reversed input reverses indices
        const rev = buildEdgeSlotIndex([...base].reverse());
        expect(rev.get('c')).toEqual({ index: 0, total: 3 });
        expect(rev.get('a')).toEqual({ index: 2, total: 3 });
    });

    it('groups by target + targetHandle with null-safe key', () => {
        const edges: Edge[] = [
            { id: 'a', source: 'x', target: 'T', targetHandle: null } as unknown as Edge,
            { id: 'b', source: 'y', target: 'T', targetHandle: undefined } as unknown as Edge,
            { id: 'c', source: 'z', target: 'T', targetHandle: 'h' } as Edge,
        ];
        const idx = buildEdgeSlotIndex(edges);
        expect(idx.get('a')).toEqual({ index: 0, total: 2 });
        expect(idx.get('b')).toEqual({ index: 1, total: 2 });
        expect(idx.get('c')).toEqual({ index: 0, total: 1 });
    });

    it('WeakMap caches per edges array identity', () => {
        const edges = randomEdges(10, 7);
        expect(getEdgeSlotIndex(edges)).toBe(getEdgeSlotIndex(edges));
        expect(getEdgeSlotIndex([...edges])).not.toBe(getEdgeSlotIndex(edges));
    });

    it('insert/remove middle edge updates siblings immediately', () => {
        const edges = randomEdges(50, 9);
        const before = buildEdgeSlotIndex(edges);
        const removed = edges.filter((e) => e.id !== 'e25');
        const after = buildEdgeSlotIndex(removed);
        // removed id gone; a sibling of same group has total-1
        expect(after.get('e25')).toBeUndefined();
        const victim = edges.find((e) => e.id === 'e25')!;
        for (const e of removed) {
            if (e.target === victim.target && e.targetHandle === victim.targetHandle) {
                expect(after.get(e.id)!.total).toBe(before.get(e.id)!.total - 1);
                break;
            }
        }
    });
});
