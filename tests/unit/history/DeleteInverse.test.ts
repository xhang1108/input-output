/**
 * @vitest-environment jsdom
 *
 * P2-2 regression: a node deletion cascades every incident edge inside the
 * Brain, so the recorded inverse must re-add the node *and* every edge that
 * touched it. This locks the hand-written inverse until the shared builder
 * lands.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';
import { computeNextState } from '@/hooks/useHistoryExecutor';

const mocks = vi.hoisted(() => ({
    applyTransaction: vi.fn<(tx: unknown) => { success: boolean }>(() => ({ success: true })),
    push: vi.fn<(entry: unknown) => void>(),
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
            setNodes: vi.fn(),
            setEdges: vi.fn(),
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
    useHistoryStore: (selector: (state: { push: typeof mocks.push }) => unknown) =>
        selector({ push: mocks.push }),
}));

import { useSelection } from '@/hooks/useSelection';

function makeNode(id: string, extra: Partial<Node> = {}): Node {
    return {
        id,
        type: 'test',
        position: { x: 0, y: 0 },
        data: { label: id },
        selected: false,
        ...extra,
    } as Node;
}

describe('delete selected node with edges', () => {
    beforeEach(() => {
        nodes = [];
        edges = [];
        mocks.applyTransaction.mockClear();
        mocks.push.mockClear();
    });

    it('records CONNECT inverses for every incident edge only', () => {
        nodes = [
            makeNode('a', { selected: true }),
            makeNode('b'),
            makeNode('c'),
        ];
        edges = [
            { id: 'e1', source: 'a', target: 'b' } as Edge,
            { id: 'e2', source: 'c', target: 'a' } as Edge,
            { id: 'e3', source: 'b', target: 'c' } as Edge,
        ];

        const { result } = renderHook(() => useSelection());
        act(() => {
            result.current.deleteSelected();
        });

        expect(mocks.applyTransaction).toHaveBeenCalledTimes(1);
        const entry = mocks.push.mock.calls[0][0] as {
            inverse: Array<{ type: string; payload: any }>;
            forward: Array<{ type: string; payload: any }>;
        };

        expect(entry.inverse.filter(tx => tx.type === 'ADD_NODE').map(tx => tx.payload.id)).toEqual(['a']);
        expect(entry.inverse.filter(tx => tx.type === 'CONNECT').map(tx => tx.payload.id)).toEqual(['e1', 'e2']);
        expect(entry.forward.filter(tx => tx.type === 'REMOVE_NODE').map(tx => tx.payload)).toEqual(['a']);
    });

    it('replays the inverse back to the pre-delete edges', () => {
        const originalNodes = [makeNode('a'), makeNode('b')];
        const originalEdges = [{ id: 'e1', source: 'a', target: 'b' } as Edge];

        const inverse = [
            { type: 'ADD_NODE' as const, payload: { ...originalNodes[0], initialValue: originalNodes[0].data.value } },
            { type: 'CONNECT' as const, payload: { ...originalEdges[0] } },
        ];

        // State after the delete: node and edge are gone.
        const { nextNodes, nextEdges } = computeNextState(inverse, [originalNodes[1]], []);

        expect(nextNodes.map(n => n.id).sort()).toEqual(['a', 'b']);
        expect(nextEdges.map(e => e.id)).toEqual(['e1']);
    });
});
