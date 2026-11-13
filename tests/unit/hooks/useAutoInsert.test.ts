/**
 * @vitest-environment jsdom
 *
 * P0-4: auto-insert sensing runs in flow (world) space. Nested nodes must be
 * resolved through the coordinate contract, and emitted positions (the drag
 * restore) must stay parent-local.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';
import type { Brain } from '@/engine/Brain';

const mocks = vi.hoisted(() => ({
    setHighlightedEdgeId: vi.fn<(id: string | null) => void>(),
    push: vi.fn<(entry: any) => void>(),
    applyTransaction: vi.fn<(tx: any) => { success: boolean }>(() => ({ success: true })),
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

import { useAutoInsert } from '@/hooks/useAutoInsert';

function makeNode(
    id: string,
    x: number,
    y: number,
    options: { parentId?: string; selected?: boolean } = {}
): Node {
    return {
        id,
        type: 'test',
        position: { x, y },
        parentId: options.parentId,
        selected: options.selected ?? false,
        data: {},
    } as unknown as Node;
}

const brain = { applyTransaction: mocks.applyTransaction } as unknown as Brain;
const logAction = () => {};

function stubEdgePath(point: { x: number; y: number }) {
    const path = {
        getTotalLength: () => 0,
        getPointAtLength: () => point,
    };
    const container = { querySelector: () => path };
    vi.spyOn(document, 'querySelector').mockImplementation(((
        selector: string
    ) => (selector.includes('e1') ? container : null)) as typeof document.querySelector);
}

describe('useAutoInsert absolute sensing', () => {
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

    it('senses at the world-space red dot of a nested node', () => {
        // Selected child local (10,20) inside frame (1000,500) => world (1010,520).
        // Red dot offset (60,40) => sensing center (1070,560).
        nodes = [
            makeNode('frame', 1000, 500),
            makeNode('src', 30, 40, { parentId: 'frame' }),
            makeNode('dst', 100, 100),
            makeNode('moving', 10, 20, { parentId: 'frame', selected: true }),
        ];
        edges = [{ id: 'e1', source: 'src', target: 'dst' } as Edge];
        stubEdgePath({ x: 1070, y: 560 });

        const { result } = renderHook(() => useAutoInsert({ mode: 'GRABBING', brain, logAction }));
        act(() => {
            result.current.detectAutoInsert();
        });

        expect(mocks.setHighlightedEdgeId).toHaveBeenCalledWith('e1');
    });

    it('keeps the flat root sensing centre unchanged', () => {
        // Root (10,20) => sensing center (70,60).
        nodes = [
            makeNode('src', 100, 100),
            makeNode('dst', 300, 100),
            makeNode('moving', 10, 20, { selected: true }),
        ];
        edges = [{ id: 'e1', source: 'src', target: 'dst' } as Edge];
        stubEdgePath({ x: 70, y: 60 });

        const { result } = renderHook(() => useAutoInsert({ mode: 'GRABBING', brain, logAction }));
        act(() => {
            result.current.detectAutoInsert();
        });

        expect(mocks.setHighlightedEdgeId).toHaveBeenCalledWith('e1');
    });

    it('emits the drag restore position in parent-local space', () => {
        nodes = [
            makeNode('frame', 1000, 500),
            makeNode('src', 30, 40, { parentId: 'frame' }),
            makeNode('dst', 100, 100),
            makeNode('moving', 10, 20, { parentId: 'frame', selected: true }),
        ];
        edges = [{ id: 'e1', source: 'src', target: 'dst' } as Edge];

        const { result, rerender } = renderHook(
            ({ mode }: { mode: string }) => useAutoInsert({ mode, brain, logAction }),
            { initialProps: { mode: 'GRABBING' } }
        );

        appState.highlightedEdgeId = 'e1';
        rerender({ mode: 'GRABBING' });

        act(() => {
            result.current.performAutoInsert();
        });

        expect(mocks.applyTransaction).toHaveBeenCalledTimes(1);
        const forward = (mocks.applyTransaction.mock.calls[0][0] as {
            payload: Array<{ type: string }>;
        }).payload;
        expect(forward.map(tx => tx.type)).toEqual(['DISCONNECT', 'CONNECT', 'CONNECT']);

        const entry = mocks.push.mock.calls[0][0] as {
            inverse: Array<{ type: string; payload: any }>;
        };
        const move = entry.inverse.find(tx => tx.type === 'MOVE_NODE')!;
        // Local (10,20), never the absolute (1010,520).
        expect(move.payload).toEqual({ id: 'moving', position: { x: 10, y: 20 } });
    });
});
