/**
 * @vitest-environment jsdom
 *
 * P0-4: knife geometry must run in flow (world) space. A nested node's
 * `position` is parent-local, so cut detection has to resolve absolute
 * positions through the coordinate contract.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';

const mocks = vi.hoisted(() => ({
    push: vi.fn<(entry: any) => void>(),
    setEdges: vi.fn<(updater: any) => void>(),
    project: vi.fn((p: { x: number; y: number }) => p),
}));

let nodes: Node[] = [];
let edges: Edge[] = [];

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => ({
            getNodes: () => nodes,
            getEdges: () => edges,
            setEdges: mocks.setEdges,
        }),
    };
});

vi.mock('@/hooks/useCanvasProjection', () => ({
    useCanvasProjection: () => ({ project: mocks.project }),
}));

vi.mock('@/store/useHistoryStore', () => ({
    useHistoryStore: {
        getState: () => ({ isRestoring: false, push: mocks.push }),
    },
}));

import { useKnife } from '@/hooks/useKnife';

function makeNode(
    id: string,
    x: number,
    y: number,
    extra: { parentId?: string; width?: number; height?: number } = {}
): Node {
    const width = extra.width ?? 100;
    const height = extra.height ?? 50;
    return {
        id,
        type: 'test',
        position: { x, y },
        parentId: extra.parentId,
        width,
        height,
        measured: { width, height },
        data: {},
    } as unknown as Node;
}

function cutVertically(x: number) {
    const { result } = renderHook(() => useKnife());
    act(() => {
        result.current.startCut({ x, y: -1000 });
        result.current.updateCut({ x, y: 1000 });
        result.current.endCut();
    });
    return result;
}

describe('useKnife absolute geometry', () => {
    beforeEach(() => {
        nodes = [];
        edges = [];
        mocks.push.mockClear();
        mocks.setEdges.mockClear();
    });

    it('cuts a wire whose child endpoint sits inside a frame', () => {
        // frame at (1000,500); child local (30,40) => absolute (1030,540).
        // Wire: x 1130 -> 100, y 610 -> 170 (world space).
        nodes = [
            makeNode('frame', 1000, 500, { width: 400, height: 300 }),
            makeNode('src', 30, 40, { parentId: 'frame' }),
            makeNode('dst', 100, 100),
        ];
        edges = [{ id: 'e1', source: 'src', target: 'dst' } as Edge];

        cutVertically(1100);

        expect(mocks.push).toHaveBeenCalledTimes(1);
        const entry = mocks.push.mock.calls[0][0] as {
            forward: Array<{ type: string; payload: unknown }>;
            inverse: Array<{ type: string; payload: unknown }>;
        };
        expect(entry.forward).toEqual([{ type: 'DISCONNECT', payload: 'e1' }]);
        expect(entry.inverse).toEqual([{ type: 'CONNECT', payload: edges[0] }]);
        expect(mocks.setEdges).toHaveBeenCalledTimes(1);
    });

    it('keeps root-only (flat) cut behaviour identical', () => {
        // No parents: position already is world space.
        nodes = [
            makeNode('src', 10, 10),
            makeNode('dst', 400, 100),
        ];
        edges = [{ id: 'e1', source: 'src', target: 'dst' } as Edge];

        cutVertically(250);

        expect(mocks.push).toHaveBeenCalledTimes(1);
        const entry = mocks.push.mock.calls[0][0] as {
            forward: Array<{ type: string; payload: unknown }>;
        };
        expect(entry.forward).toEqual([{ type: 'DISCONNECT', payload: 'e1' }]);
    });

    it('ignores a cut that only crosses the frame-local wire coordinates', () => {
        // Same nested graph. The local (wrong) wire would be (130,110)-(100,170);
        // a horizontal cut at y=140 through that stub must not match the real
        // world-space wire, which passes y=140 outside the source->target span.
        nodes = [
            makeNode('frame', 1000, 500, { width: 400, height: 300 }),
            makeNode('src', 30, 40, { parentId: 'frame' }),
            makeNode('dst', 100, 100),
        ];
        edges = [{ id: 'e1', source: 'src', target: 'dst' } as Edge];

        const { result } = renderHook(() => useKnife());
        act(() => {
            result.current.startCut({ x: 50, y: 140 });
            result.current.updateCut({ x: 200, y: 140 });
            result.current.endCut();
        });

        expect(mocks.push).not.toHaveBeenCalled();
        expect(mocks.setEdges).not.toHaveBeenCalled();
    });
});
