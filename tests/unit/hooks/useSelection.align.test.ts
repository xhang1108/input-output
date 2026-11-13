/**
 * @vitest-environment jsdom
 *
 * P0-4: align must compare absolute positions and write parent-local ones.
 * Nodes under different parents have to land on the same visual line.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';

const mocks = vi.hoisted(() => ({
    applyTransaction: vi.fn<(tx: any) => { success: boolean }>(() => ({ success: true })),
    push: vi.fn<(entry: any) => void>(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
}));

let nodes: Node[] = [];

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => ({
            getNodes: () => nodes,
            setNodes: mocks.setNodes,
            getEdges: () => [],
            setEdges: mocks.setEdges,
        }),
    };
});

vi.mock('@/context/BrainContext', () => ({
    useBrain: () => ({
        applyTransaction: mocks.applyTransaction,
        getPhysicsConfig: () => ({}),
    }),
}));

vi.mock('@/store/useHistoryStore', () => ({
    useHistoryStore: (selector: (s: unknown) => unknown) =>
        selector({ push: mocks.push }),
}));

import { useSelection } from '@/hooks/useSelection';

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
        selected: options.selected ?? true,
        data: {},
    } as unknown as Node;
}

function align(axis: 'X' | 'Y') {
    const { result } = renderHook(() => useSelection());
    act(() => {
        result.current.alignSelectedNodes(axis);
    });
}

function lastBatch(): Array<{ type: string; payload: any }> {
    const call = mocks.applyTransaction.mock.calls[0][0] as {
        type: string;
        payload: Array<{ type: string; payload: any }>;
    };
    expect(call.type).toBe('BATCH');
    return call.payload;
}

describe('useSelection.alignSelectedNodes absolute alignment', () => {
    beforeEach(() => {
        nodes = [];
        mocks.applyTransaction.mockClear();
        mocks.push.mockClear();
    });

    it('aligns children of different frames on the same world-space X', () => {
        // cA absolute x = 1030, cB absolute x = 600 -> anchor 600.
        nodes = [
            makeNode('frameA', 1000, 500, { selected: false }),
            makeNode('cA', 30, 40, { parentId: 'frameA' }),
            makeNode('frameB', 500, 200, { selected: false }),
            makeNode('cB', 100, 300, { parentId: 'frameB' }),
        ];

        align('X');

        const moves = lastBatch();
        expect(moves).toHaveLength(1);
        // cA must store the parent-local value (600 - 1000), never 600 itself.
        expect(moves[0]).toEqual({
            type: 'MOVE_NODE',
            payload: { id: 'cA', position: { x: -400, y: 40 } },
        });

        const entry = mocks.push.mock.calls[0][0] as {
            inverse: Array<{ type: string; payload: any }>;
        };
        expect(entry.inverse).toEqual([{
            type: 'MOVE_NODE',
            payload: { id: 'cA', position: { x: 30, y: 40 } },
        }]);
    });

    it('aligns a root with a child of a frame without writing an absolute position', () => {
        // Root at x=900 is the anchor; child absolute x=1030 moves to 900.
        nodes = [
            makeNode('root', 900, 900),
            makeNode('frame', 1000, 500, { selected: false }),
            makeNode('child', 30, 40, { parentId: 'frame' }),
        ];

        align('X');

        const moves = lastBatch();
        expect(moves).toHaveLength(1);
        expect(moves[0]).toEqual({
            type: 'MOVE_NODE',
            payload: { id: 'child', position: { x: -100, y: 40 } },
        });
        expect(moves[0].payload.position.x).not.toBe(900);
    });

    it('keeps flat root behaviour unchanged', () => {
        nodes = [
            makeNode('a', 100, 100),
            makeNode('b', 300, 200),
        ];

        align('Y');

        const moves = lastBatch();
        expect(moves).toHaveLength(1);
        expect(moves[0]).toEqual({
            type: 'MOVE_NODE',
            payload: { id: 'b', position: { x: 300, y: 100 } },
        });
    });
});
