/**
 * @vitest-environment jsdom
 *
 * useNodeEdit records node field edits in the history store:
 * - forward patch + inverse with the FULL previous data
 * - value edits inverse unwraps the UI payload
 * - Brain refusals never reach history
 * - repeated edits of one field collapse into one entry
 */
import { act, renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const history: { past: any[] } = { past: [] };
    const push = vi.fn((entry: any) => {
        history.past.push(entry);
    });
    const replaceLast = vi.fn((expectedId: string, entry: any) => {
        const last = history.past[history.past.length - 1];
        if (!last || last.id !== expectedId) return false;
        history.past[history.past.length - 1] = entry;
        return true;
    });
    const applyTransaction = vi.fn<(...args: any[]) => { success: boolean }>(() => ({ success: true }));
    return { history, push, replaceLast, applyTransaction };
});

let nodes: Node[] = [];

vi.mock('@xyflow/react', () => ({
    useReactFlow: () => ({ getNodes: () => nodes }),
}));

vi.mock('@/context/BrainContext', () => ({
    useBrain: () => ({ applyTransaction: mocks.applyTransaction }),
}));

vi.mock('@/store/useHistoryStore', () => {
    const api = {
        push: mocks.push,
        replaceLast: mocks.replaceLast,
        getState: () => ({
            past: mocks.history.past,
            push: mocks.push,
            replaceLast: mocks.replaceLast,
        }),
    };
    const useHistoryStore = ((selector: (state: typeof api) => unknown) => selector(api)) as any;
    useHistoryStore.getState = api.getState;
    return { useHistoryStore };
});

import { useNodeEdit } from '@/hooks/useNodeEdit';

function makeNode(id: string, data: Record<string, unknown>): Node {
    return {
        id,
        type: 'test',
        position: { x: 0, y: 0 },
        data,
    } as unknown as Node;
}

function renderEdit() {
    return renderHook(() => useNodeEdit());
}

describe('useNodeEdit.editNodesData', () => {
    beforeEach(() => {
        nodes = [];
        mocks.history.past.length = 0;
        mocks.push.mockClear();
        mocks.replaceLast.mockClear();
        mocks.applyTransaction.mockReset();
        mocks.applyTransaction.mockReturnValue({ success: true });
    });

    it('applies one BATCH and records the patch plus the full previous data', () => {
        nodes = [makeNode('n1', { a: 1, b: 2 })];
        const { result } = renderEdit();

        let ok = false;
        act(() => {
            ok = result.current.editNodesData(
                [{ id: 'n1', patch: { a: 9 } }],
                { description: 'Edit a' }
            );
        });

        expect(ok).toBe(true);
        expect(mocks.applyTransaction).toHaveBeenCalledTimes(1);
        expect(mocks.applyTransaction.mock.calls[0][0]).toEqual({
            type: 'BATCH',
            payload: [{ type: 'UPDATE_NODE_DATA', payload: { id: 'n1', data: { a: 9 } } }],
        });

        expect(mocks.push).toHaveBeenCalledTimes(1);
        const entry = mocks.history.past.at(-1)!;
        expect(entry.description).toBe('Edit a');
        expect(entry.forward).toEqual([
            { type: 'UPDATE_NODE_DATA', payload: { id: 'n1', data: { a: 9 } } },
        ]);
        expect(entry.inverse).toEqual([
            { type: 'UPDATE_NODE_DATA', payload: { id: 'n1', data: { a: 1, b: 2 } } },
        ]);
    });

    it('refuses in read-only mode without touching the Brain or history', () => {
        nodes = [makeNode('n1', { a: 1 })];
        const { result } = renderHook(() => useNodeEdit({ isReadOnly: true }));

        let ok = true;
        act(() => {
            ok = result.current.editNodesData([{ id: 'n1', patch: { a: 2 } }], { description: 'Edit a' });
        });

        expect(ok).toBe(false);
        expect(mocks.applyTransaction).not.toHaveBeenCalled();
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it('refuses an empty edit list', () => {
        nodes = [makeNode('n1', { a: 1 })];
        const { result } = renderEdit();

        let ok = true;
        act(() => {
            ok = result.current.editNodesData([], { description: 'Edit a' });
        });

        expect(ok).toBe(false);
        expect(mocks.applyTransaction).not.toHaveBeenCalled();
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it('pushes nothing when the Brain rejects the transaction', () => {
        nodes = [makeNode('n1', { a: 1 })];
        mocks.applyTransaction.mockReturnValueOnce({ success: false });
        const { result } = renderEdit();

        let ok = true;
        act(() => {
            ok = result.current.editNodesData([{ id: 'n1', patch: { a: 2 } }], { description: 'Edit a' });
        });

        expect(ok).toBe(false);
        expect(mocks.applyTransaction).toHaveBeenCalledTimes(1);
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it('merges a burst into one entry and keeps the first inverse', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            vi.setSystemTime(new Date('2026-11-14T00:00:00Z'));
            nodes = [makeNode('n1', { a: 1, b: 2 })];
            const { result } = renderEdit();

            act(() => {
                result.current.editNodesData([{ id: 'n1', patch: { a: 9 } }], {
                    description: 'Edit a',
                    mergeId: 'merge-burst-1',
                    mergeWindowMs: 500,
                });
            });

            // Simulate the Brain projection landing on the UI node.
            nodes = [makeNode('n1', { a: 9, b: 2 })];
            vi.setSystemTime(new Date('2026-11-14T00:00:00.200Z'));

            act(() => {
                result.current.editNodesData([{ id: 'n1', patch: { a: 10 } }], {
                    description: 'Edit a',
                    mergeId: 'merge-burst-1',
                    mergeWindowMs: 500,
                });
            });

            expect(mocks.push).toHaveBeenCalledTimes(1);
            expect(mocks.replaceLast).toHaveBeenCalledTimes(1);
            expect(mocks.history.past).toHaveLength(1);

            const merged = mocks.history.past[0];
            expect(merged.id).toBe('merge-burst-1');
            expect(merged.forward).toEqual([
                { type: 'UPDATE_NODE_DATA', payload: { id: 'n1', data: { a: 10 } } },
            ]);
            // Undo returns to the data before typing started.
            expect(merged.inverse).toEqual([
                { type: 'UPDATE_NODE_DATA', payload: { id: 'n1', data: { a: 1, b: 2 } } },
            ]);
        } finally {
            vi.useRealTimers();
        }
    });

    it('pushes a new entry once the merge window has passed', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            vi.setSystemTime(new Date('2026-11-14T00:00:00Z'));
            nodes = [makeNode('n1', { a: 1 })];
            const { result } = renderEdit();

            act(() => {
                result.current.editNodesData([{ id: 'n1', patch: { a: 2 } }], {
                    description: 'Edit a',
                    mergeId: 'merge-window-1',
                    mergeWindowMs: 500,
                });
            });

            vi.setSystemTime(new Date('2026-11-14T00:00:02Z'));
            act(() => {
                result.current.editNodesData([{ id: 'n1', patch: { a: 3 } }], {
                    description: 'Edit a',
                    mergeId: 'merge-window-1',
                    mergeWindowMs: 500,
                });
            });

            expect(mocks.replaceLast).not.toHaveBeenCalled();
            expect(mocks.push).toHaveBeenCalledTimes(2);
            expect(mocks.history.past).toHaveLength(2);
        } finally {
            vi.useRealTimers();
        }
    });

    it('keeps one inverse per node when a multi-node burst merges', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            vi.setSystemTime(new Date('2026-11-14T00:00:00Z'));
            nodes = [makeNode('a', { muted: false }), makeNode('b', { muted: false })];
            const { result } = renderEdit();

            act(() => {
                result.current.editNodesData(
                    [
                        { id: 'a', patch: { muted: true } },
                        { id: 'b', patch: { muted: true } },
                    ],
                    { description: 'Toggle Mute', mergeId: 'merge-multi-1' }
                );
            });

            nodes = [makeNode('a', { muted: true }), makeNode('b', { muted: true })];
            vi.setSystemTime(new Date('2026-11-14T00:00:00.100Z'));

            act(() => {
                result.current.editNodesData(
                    [
                        { id: 'a', patch: { muted: false } },
                        { id: 'b', patch: { muted: false } },
                    ],
                    { description: 'Toggle Mute', mergeId: 'merge-multi-1' }
                );
            });

            const merged = mocks.history.past[0];
            expect(merged.inverse.map((tx: any) => tx.payload)).toEqual([
                { id: 'a', data: { muted: false } },
                { id: 'b', data: { muted: false } },
            ]);
            expect(merged.forward.map((tx: any) => tx.payload)).toEqual([
                { id: 'a', data: { muted: false } },
                { id: 'b', data: { muted: false } },
            ]);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('useNodeEdit.editNodeValue', () => {
    beforeEach(() => {
        nodes = [];
        mocks.history.past.length = 0;
        mocks.push.mockClear();
        mocks.replaceLast.mockClear();
        mocks.applyTransaction.mockReset();
        mocks.applyTransaction.mockReturnValue({ success: true });
    });

    it('unwraps the previous payload for the inverse', () => {
        nodes = [makeNode('n1', {
            value: { type: 'Scalar', value: 42, symbol: null, meta: {} },
        })];
        const { result } = renderEdit();

        let ok = false;
        act(() => {
            ok = result.current.editNodeValue('n1', 7, { description: 'Edit value' });
        });

        expect(ok).toBe(true);
        expect(mocks.applyTransaction).toHaveBeenCalledWith({
            type: 'UPDATE_VALUE',
            payload: { id: 'n1', value: 7 },
        });

        const entry = mocks.history.past.at(-1)!;
        expect(entry.forward).toEqual([
            { type: 'UPDATE_VALUE', payload: { id: 'n1', value: 7 } },
        ]);
        expect(entry.inverse).toEqual([
            { type: 'UPDATE_VALUE', payload: { id: 'n1', value: 42 } },
        ]);
    });

    it('pushes nothing when the Brain rejects the value write', () => {
        nodes = [makeNode('n1', { value: 1 })];
        mocks.applyTransaction.mockReturnValueOnce({ success: false });
        const { result } = renderEdit();

        let ok = true;
        act(() => {
            ok = result.current.editNodeValue('n1', 2);
        });

        expect(ok).toBe(false);
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it('refuses an unknown node', () => {
        const { result } = renderEdit();
        let ok = true;
        act(() => {
            ok = result.current.editNodeValue('missing', 2);
        });
        expect(ok).toBe(false);
        expect(mocks.applyTransaction).not.toHaveBeenCalled();
    });
});
