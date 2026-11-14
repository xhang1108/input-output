/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';

const mocks = vi.hoisted(() => ({
    applyTransaction: vi.fn<(tx: any) => { success: boolean }>(() => ({ success: true })),
    push: vi.fn<(entry: any) => void>(),
}));

let nodes: Node[] = [];

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => ({ getNodes: () => nodes }),
    };
});

vi.mock('@/context/BrainContext', () => ({
    useBrain: () => ({
        applyTransaction: mocks.applyTransaction,
    }),
}));

vi.mock('@/store/useHistoryStore', () => ({
    useHistoryStore: (selector: (s: unknown) => unknown) =>
        selector({ push: mocks.push }),
}));

import { useFrameActions } from '@/hooks/useFrameActions';

function makeNode(
    id: string,
    x: number,
    y: number,
    options: { parentId?: string; selected?: boolean; width?: number; height?: number; type?: string } = {}
): Node {
    return {
        id,
        type: options.type ?? 'test',
        position: { x, y },
        parentId: options.parentId,
        selected: options.selected ?? true,
        width: options.width,
        height: options.height,
        measured: { width: options.width ?? 100, height: options.height ?? 50 },
        data: { width: options.width ?? 100, height: options.height ?? 50 },
    };
}

describe('useFrameActions', () => {
    beforeEach(() => {
        nodes = [];
        mocks.applyTransaction.mockClear();
        mocks.push.mockClear();
    });

    it('groups selected roots into a frame with relative children', () => {
        nodes = [
            makeNode('a', 100, 100, { width: 100, height: 50 }),
            makeNode('b', 300, 200, { width: 120, height: 60 }),
        ];

        const { result } = renderHook(() => useFrameActions());
        let grouped = false;
        act(() => {
            grouped = result.current.frameSelected();
        });

        expect(grouped).toBe(true);
        expect(mocks.applyTransaction).toHaveBeenCalledTimes(1);

        const batch = mocks.applyTransaction.mock.calls[0][0] as {
            type: string;
            payload: Array<{ type: string; payload: any }>;
        };
        const add = batch.payload.find(tx => tx.type === 'ADD_NODE')!;
        const moves = batch.payload.filter(tx => tx.type === 'MOVE_NODE');

        expect(add.payload.type).toBe('frame');
        expect(add.payload.position).toEqual({ x: 68, y: 60 });
        expect(add.payload.width).toBe(384);
        expect(add.payload.height).toBe(232);

        expect(moves).toHaveLength(2);
        for (const move of moves) {
            expect(move.payload.parentId).toBe(add.payload.id);
        }
        expect(moves.find(tx => tx.payload.id === 'a')!.payload.position).toEqual({ x: 32, y: 40 });
        expect(moves.find(tx => tx.payload.id === 'b')!.payload.position).toEqual({ x: 232, y: 140 });

        expect(mocks.push).toHaveBeenCalledTimes(1);
    });

    it('ungroups direct children of the same frame and removes the empty frame', () => {
        nodes = [
            makeNode('f1', 50, 50, { type: 'frame', selected: false, width: 300, height: 200 }),
            makeNode('c1', 10, 10, { parentId: 'f1' }),
        ];

        const { result } = renderHook(() => useFrameActions());
        let ungrouped = false;
        act(() => {
            ungrouped = result.current.frameSelected();
        });

        expect(ungrouped).toBe(true);

        const batch = mocks.applyTransaction.mock.calls[0][0] as {
            payload: Array<{ type: string; payload: any }>;
        };
        const move = batch.payload.find(tx => tx.type === 'MOVE_NODE')!;
        const remove = batch.payload.find(tx => tx.type === 'REMOVE_NODE')!;

        expect(move.payload.position).toEqual({ x: 60, y: 60 });
        expect(move.payload.parentId).toBeNull();
        expect(remove.payload).toBe('f1');

        const entry = mocks.push.mock.calls[0][0] as {
            inverse: Array<{ type: string; payload: any }>;
        };
        const restoreMove = entry.inverse.find(tx => tx.type === 'MOVE_NODE')!;
        const restoreFrame = entry.inverse.find(tx => tx.type === 'ADD_NODE')!;
        expect(restoreMove.payload.position).toEqual({ x: 10, y: 10 });
        expect(restoreMove.payload.parentId).toBe('f1');
        expect(restoreFrame.payload.id).toBe('f1');
    });

    it('refuses a mixed root/child selection', () => {
        nodes = [
            makeNode('root', 0, 0),
            makeNode('f1', 50, 50, { type: 'frame', selected: false }),
            makeNode('child', 10, 10, { parentId: 'f1' }),
        ];

        const { result } = renderHook(() => useFrameActions());
        let grouped = true;
        act(() => {
            grouped = result.current.frameSelected();
        });

        expect(grouped).toBe(false);
        expect(mocks.applyTransaction).not.toHaveBeenCalled();
    });

    it('detaches a child to world coordinates with undo', () => {
        nodes = [
            makeNode('f1', 50, 50, { type: 'frame', selected: false, width: 300, height: 200 }),
            makeNode('c1', 10, 10, { parentId: 'f1' }),
        ];

        const { result } = renderHook(() => useFrameActions());
        let detached = false;
        act(() => {
            detached = result.current.detachNode('c1');
        });

        expect(detached).toBe(true);
        const batch = mocks.applyTransaction.mock.calls[0][0] as {
            payload: Array<{ type: string; payload: any }>;
        };
        const move = batch.payload.find(tx => tx.type === 'MOVE_NODE')!;
        expect(move.payload).toEqual({ id: 'c1', position: { x: 60, y: 60 }, parentId: null });

        const entry = mocks.push.mock.calls[0][0] as {
            inverse: Array<{ type: string; payload: any }>;
        };
        const inverse = entry.inverse.find(tx => tx.type === 'MOVE_NODE')!;
        expect(inverse.payload).toEqual({ id: 'c1', position: { x: 10, y: 10 }, parentId: 'f1' });
    });

    it('fits a frame to its children and keeps their world position', () => {
        nodes = [
            makeNode('f1', 100, 100, { type: 'frame', selected: false, width: 600, height: 500 }),
            makeNode('c1', 200, 200, { parentId: 'f1', width: 100, height: 50 }),
        ];

        const { result } = renderHook(() => useFrameActions());
        let fitted = false;
        act(() => {
            fitted = result.current.fitFrame('f1');
        });

        expect(fitted).toBe(true);
        const batch = mocks.applyTransaction.mock.calls[0][0] as {
            type: string;
            payload: Array<{ type: string; payload: any }>;
        };
        expect(batch.type).toBe('BATCH');
        expect(batch.payload).toEqual(expect.arrayContaining([
            { type: 'MOVE_NODE', payload: { id: 'f1', position: { x: 268, y: 260 } } },
            { type: 'RESIZE_NODE', payload: { id: 'f1', width: 200, height: 122 } },
            { type: 'MOVE_NODE', payload: { id: 'c1', position: { x: 32, y: 40 } } },
        ]));

        const entry = mocks.push.mock.calls[0][0] as {
            forward: Array<{ type: string; payload: any }>;
            inverse: Array<{ type: string; payload: any }>;
        };
        expect(entry.inverse).toEqual(expect.arrayContaining([
            { type: 'MOVE_NODE', payload: { id: 'f1', position: { x: 100, y: 100 } } },
            { type: 'RESIZE_NODE', payload: { id: 'f1', width: 600, height: 500 } },
            { type: 'MOVE_NODE', payload: { id: 'c1', position: { x: 200, y: 200 } } },
        ]));
    });

    it('does not record history when the frame already fits', () => {
        nodes = [
            makeNode('f1', 268, 260, { type: 'frame', selected: false, width: 200, height: 122 }),
            makeNode('c1', 32, 40, { parentId: 'f1', width: 100, height: 50 }),
        ];

        const { result } = renderHook(() => useFrameActions());
        let fitted = true;
        act(() => {
            fitted = result.current.fitFrame('f1');
        });

        expect(fitted).toBe(false);
        expect(mocks.applyTransaction).not.toHaveBeenCalled();
        expect(mocks.push).not.toHaveBeenCalled();
    });
});
