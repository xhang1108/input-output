/**
 * @vitest-environment jsdom
 *
 * Auto-insert grab-session cache: candidate prefilter, path length cache and
 * the connection guard. Geometry tests stay pure (no DOM); the two hook tests
 * only verify that the per-grab cache removes per-frame scans.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';
import type { Brain } from '@/engine/Brain';
import type { CoordinateNode } from '@/utils/coordinates';

const mocks = vi.hoisted(() => ({
    setHighlightedEdgeId: vi.fn<(id: string | null) => void>(),
    push: vi.fn(),
    applyTransaction: vi.fn(() => ({ success: true })),
}));

let nodes: Node[] = [];
let edges: Edge[] = [];
const appState: { highlightedEdgeId: string | null } = { highlightedEdgeId: null };

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => ({
            getNodes: () => nodes,
            getEdges: () => edges,
        }),
    };
});

vi.mock('@/store/useStore', () => ({
    useAppStore: (selector: (s: Record<string, unknown>) => unknown) => selector({
        ...appState,
        setHighlightedEdgeId: mocks.setHighlightedEdgeId,
    }),
}));

vi.mock('@/store/useHistoryStore', () => ({
    useHistoryStore: (selector: (s: unknown) => unknown) => selector({ push: mocks.push }),
}));

import {
    buildEdgeBounds,
    getOrMeasure,
    pickCandidateEdgeIds,
    useAutoInsert,
    type Bounds,
    type BoundedNode,
    type PathCacheEntry,
    type PathMeasure,
} from '@/hooks/useAutoInsert';

function nodeMap(
    entries: Array<[string, number, number, string?]>
): Map<string, CoordinateNode> {
    return new Map(
        entries.map(([id, x, y, parentId]) => [id, { id, position: { x, y }, parentId }])
    );
}

function makeNode(
    id: string,
    x: number,
    y: number,
    options: { selected?: boolean } = {}
): Node {
    return {
        id,
        type: 'test',
        position: { x, y },
        selected: options.selected ?? false,
        data: {},
    } as unknown as Node;
}

describe('auto-insert candidate prefilter', () => {
    it('builds absolute bounds for every edge with known endpoints', () => {
        const nodesById = nodeMap([
            ['a', 10, 20],
            ['b', 210, 120],
            ['c', 50, 400],
            ['frame', 1000, 500],
            ['child', 30, 40, 'frame'],
        ]);

        const bounds = buildEdgeBounds(nodesById, [
            { id: 'e1', source: 'a', target: 'b' },
            { id: 'e2', source: 'b', target: 'c' },
            { id: 'e3', source: 'child', target: 'a' },
            { id: 'missing-endpoint', source: 'a', target: 'nope' },
        ]);

        expect(bounds.size).toBe(3);
        expect(bounds.get('e1')).toEqual<Bounds>({ minX: 10, maxX: 210, minY: 20, maxY: 120 });
        expect(bounds.get('e2')).toEqual<Bounds>({ minX: 50, maxX: 210, minY: 120, maxY: 400 });
        // Nested node resolves through the coordinate contract.
        expect(bounds.get('e3')).toEqual<Bounds>({ minX: 10, maxX: 1030, minY: 20, maxY: 540 });
    });

    it('expands bounds to measured node rectangles so border handles stay inside', () => {
        const nodesById = new Map<string, BoundedNode>([
            ['a', { id: 'a', position: { x: 0, y: 0 }, measured: { width: 200, height: 100 } }],
            ['b', { id: 'b', position: { x: 400, y: 0 }, measured: { width: 200, height: 100 } }],
        ]);

        const bounds = buildEdgeBounds(nodesById, [{ id: 'e1', source: 'a', target: 'b' }]);

        expect(bounds.get('e1')).toEqual<Bounds>({ minX: 0, maxX: 600, minY: 0, maxY: 100 });
        // A real horizontal path sits at the node border (y = 50); a top-left
        // position box alone would miss it by 35 px.
        expect(pickCandidateEdgeIds(bounds, 300, 50, 15)).toEqual(['e1']);
    });

    it('picks only edges whose bbox expanded by the radius contains the point', () => {
        const bounds = new Map<string, Bounds>([
            ['near', { minX: 0, maxX: 100, minY: 0, maxY: 100 }],
            ['far', { minX: 500, maxX: 600, minY: 500, maxY: 600 }],
        ]);

        // Inside 'near', outside 'far'.
        expect(pickCandidateEdgeIds(bounds, 110, 50, 15)).toEqual(['near']);
        // Outside both: 'near' maxX + 15 = 115.
        expect(pickCandidateEdgeIds(bounds, 116, 50, 15)).toEqual([]);
        // Just inside the expanded 'near' corner.
        expect(pickCandidateEdgeIds(bounds, -14, 114, 15)).toEqual(['near']);
    });

    it('keeps a diagonal edge whose bbox covers the point but whose path is far away', () => {
        const bounds = buildEdgeBounds(
            nodeMap([
                ['a', 0, 0],
                ['b', 200, 200],
            ]),
            [{ id: 'diagonal', source: 'a', target: 'b' }]
        );

        // The endpoint bbox covers (100,100).
        expect(pickCandidateEdgeIds(bounds, 100, 100, 15)).toEqual(['diagonal']);

        // Real cubic bezier for that edge, pulled away from the point:
        // p0=(0,0), p1=(0,0), p2=(0,200), p3=(200,200).
        const pointAt = (t: number) => {
            const u = 1 - t;
            return {
                x: 3 * u * u * t * 0 + 3 * u * t * t * 0 + t * t * t * 200,
                y: 3 * u * u * t * 0 + 3 * u * t * t * 200 + t * t * t * 200,
            };
        };

        let minDistance = Infinity;
        for (let t = 0; t <= 1; t += 0.001) {
            const p = pointAt(t);
            minDistance = Math.min(minDistance, Math.hypot(p.x - 100, p.y - 100));
        }

        // Sampling cannot hit the 15 px box, yet the prefilter returned it:
        // conservative, never drops a possible hit.
        expect(minDistance).toBeGreaterThan(15);
    });
});

describe('getOrMeasure path cache', () => {
    function fakePath(length: number, connected = true) {
        return {
            isConnected: connected,
            getTotalLength: vi.fn(() => length),
        };
    }

    it('returns the cached element and length while it is connected', () => {
        const cache = new Map<string, PathCacheEntry<PathMeasure>>();
        const path = fakePath(120);
        const resolve = vi.fn(() => path);

        const first = getOrMeasure(cache, 'e1', resolve);
        const second = getOrMeasure(cache, 'e1', resolve);

        expect(first).toEqual({ el: path, length: 120 });
        expect(second).toEqual({ el: path, length: 120 });
        expect(resolve).toHaveBeenCalledTimes(1);
        expect(path.getTotalLength).toHaveBeenCalledTimes(1);
    });

    it('re-resolves and re-measures when the cached element disconnects', () => {
        const cache = new Map<string, PathCacheEntry<PathMeasure>>();
        const firstPath = fakePath(120);
        const secondPath = fakePath(45);
        const resolve = vi.fn().mockReturnValueOnce(firstPath).mockReturnValueOnce(secondPath);

        expect(getOrMeasure(cache, 'e1', resolve)?.length).toBe(120);

        firstPath.isConnected = false;
        const remeasured = getOrMeasure(cache, 'e1', resolve);

        expect(remeasured).toEqual({ el: secondPath, length: 45 });
        expect(resolve).toHaveBeenCalledTimes(2);
        expect(cache.get('e1')).toEqual({ el: secondPath, length: 45 });
    });

    it('caches a failed resolution as null and retries it on the next call', () => {
        const cache = new Map<string, PathCacheEntry<PathMeasure>>();
        const latePath = fakePath(30);
        const resolve = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce(latePath);

        expect(getOrMeasure(cache, 'e1', resolve)).toBeNull();
        expect(cache.get('e1')).toEqual({ el: null, length: 0 });
        expect(getOrMeasure(cache, 'e1', resolve)).toEqual({ el: latePath, length: 30 });
        expect(resolve).toHaveBeenCalledTimes(2);
    });
});

describe('useAutoInsert grab session', () => {
    const brain = { applyTransaction: mocks.applyTransaction } as unknown as Brain;
    const logAction = () => {};

    beforeEach(() => {
        nodes = [];
        edges = [];
        appState.highlightedEdgeId = null;
        mocks.setHighlightedEdgeId.mockClear();
        mocks.push.mockClear();
        mocks.applyTransaction.mockClear();
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        });
        vi.stubGlobal('cancelAnimationFrame', () => 0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function stubEdgePath(edgeId: string, point: { x: number; y: number }, connected = true) {
        const path = {
            isConnected: connected,
            getTotalLength: vi.fn(() => 40),
            getPointAtLength: vi.fn(() => point),
        };
        const container = { querySelector: () => path };
        const querySelector = vi
            .spyOn(document, 'querySelector')
            .mockImplementation(((selector: string) =>
                selector.includes(edgeId) ? container : null) as typeof document.querySelector);

        return { path, querySelector };
    }

    it('aborts before any DOM scan when the dragged node already has an edge', () => {
        nodes = [
            makeNode('src', 0, 60),
            makeNode('dst', 100, 60),
            makeNode('moving', 10, 20, { selected: true }),
        ];
        // The dragged node is connected, so auto-insert must never run.
        edges = [
            { id: 'touching', source: 'moving', target: 'dst' } as Edge,
            { id: 'candidate', source: 'src', target: 'dst' } as Edge,
        ];
        const { querySelector } = stubEdgePath('candidate', { x: 70, y: 60 });

        const { result } = renderHook(() => useAutoInsert({ mode: 'GRABBING', brain, logAction }));
        act(() => {
            result.current.detectAutoInsert();
        });

        expect(querySelector).not.toHaveBeenCalled();
        expect(mocks.setHighlightedEdgeId).not.toHaveBeenCalled();
    });

    it('measures the path once per grab across frames', () => {
        // Root (10,20) senses at (70,60); the edge runs through that point.
        nodes = [
            makeNode('src', 0, 60),
            makeNode('dst', 100, 60),
            makeNode('moving', 10, 20, { selected: true }),
        ];
        edges = [{ id: 'e1', source: 'src', target: 'dst' } as Edge];
        const { path, querySelector } = stubEdgePath('e1', { x: 70, y: 60 });

        const { result } = renderHook(() => useAutoInsert({ mode: 'GRABBING', brain, logAction }));
        act(() => {
            result.current.detectAutoInsert();
        });
        act(() => {
            result.current.detectAutoInsert();
        });

        expect(mocks.setHighlightedEdgeId).toHaveBeenLastCalledWith('e1');
        // The path is resolved once; later frames reuse the cached element.
        expect(querySelector).toHaveBeenCalledTimes(1);
        expect(path.getTotalLength).toHaveBeenCalledTimes(1);
        // STEP = 20 over a 40-unit path: 3 samples per frame.
        expect(path.getPointAtLength).toHaveBeenCalledTimes(6);
    });
});
