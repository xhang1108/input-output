/**
 * @vitest-environment jsdom
 *
 * History lifecycle: undo stacks are bound to a specific graph, so any graph
 * identity change must drop them. Otherwise Ctrl+Z replays a previous project's
 * transactions into the new graph.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { HistoryEntry } from '@/store/useHistoryStore';

const mocks = vi.hoisted(() => {
    const brain = {
        injectNodes: vi.fn(async () => [] as string[]),
        clearAll: vi.fn(),
        applyTransaction: vi.fn(() => ({ success: true })),
        emit: vi.fn(),
        toInjectable: vi.fn(() => ({ nodes: [], edges: [] })),
    };
    return { brain, calls: [] as string[] };
});

vi.mock('@/context/BrainContext', () => ({
    useBrain: () => mocks.brain,
}));

vi.mock('@/engine/GraphCodec', () => ({
    GraphCodec: {
        parse: vi.fn(() => ({ graph: { nodes: [], edges: [] }, diagnostics: [] })),
        encode: vi.fn(() => ''),
    },
}));

vi.mock('@/utils/latex/latexToGraph', () => ({
    parseLatexToGraph: vi.fn(() => [
        { type: 'ADD_NODE', payload: { id: 'n1' } },
        { type: 'CONNECT', payload: { id: 'e1' } },
    ]),
}));

import { clearHistoryForNewProject } from '@/utils/historyLifecycle';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useMouth } from '@/hooks/nerves/useMouth';

const entry = (id: string): HistoryEntry => ({
    id,
    description: `Edit ${id}`,
    forward: [{ type: 'ADD_NODE', payload: { id } } as any],
    inverse: [{ type: 'DELETE_NODE', payload: id } as any],
});

const seedHistory = (ids: string[] = ['project-a']) => {
    useHistoryStore.setState({
        past: ids.map(entry),
        future: [entry('redo-after-project-a')],
        isRestoring: true,
        interactionMode: 'GRABBING',
    });
};

const state = () => useHistoryStore.getState();

describe('clearHistoryForNewProject', () => {
    beforeEach(() => {
        seedHistory();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('resets past, future, isRestoring and interactionMode', () => {
        expect(state().past).toHaveLength(1);
        expect(state().future).toHaveLength(1);

        clearHistoryForNewProject();

        expect(state().past).toEqual([]);
        expect(state().future).toEqual([]);
        expect(state().isRestoring).toBe(false);
        expect(state().interactionMode).toBe('IDLE');
    });
});

describe('useMouth consumeGraph history lifecycle', () => {
    beforeEach(() => {
        seedHistory();
        mocks.calls.length = 0;
        mocks.brain.injectNodes.mockReset();
        mocks.brain.clearAll.mockReset();
        mocks.brain.applyTransaction.mockReset();
        mocks.brain.emit.mockReset();

        mocks.brain.injectNodes.mockImplementation(async () => {
            mocks.calls.push(`inject:${state().past.length}`);
            return [];
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('replace import (shouldClear=true) clears history only after injection', async () => {
        const { result } = renderHook(() => useMouth());

        await act(async () => {
            const res = await result.current.consumeGraph('graph', 'IOGL', true);
            expect(res.success).toBe(true);
        });

        // At injection time the old history was still present: clear ran after.
        expect(mocks.calls).toEqual(['inject:1']);
        expect(state().past).toEqual([]);
        expect(state().future).toEqual([]);
        expect(state().isRestoring).toBe(false);
        expect(state().interactionMode).toBe('IDLE');
    });

    it('append import (shouldClear=false) keeps existing history valid', async () => {
        const { result } = renderHook(() => useMouth());

        await act(async () => {
            const res = await result.current.consumeGraph('graph', 'IOGL', false);
            expect(res.success).toBe(true);
        });

        expect(mocks.brain.injectNodes).toHaveBeenCalledWith(
            { nodes: [], edges: [] },
            false,
            false,
            undefined
        );
        expect(state().past.map(e => e.id)).toEqual(['project-a']);
        expect(state().future).toHaveLength(1);
        expect(state().interactionMode).toBe('GRABBING');
    });

    it('LaTeX replace clears after clearAll and the transaction batch', async () => {
        mocks.brain.clearAll.mockImplementation(() => {
            mocks.calls.push(`clearAll:${state().past.length}`);
        });
        mocks.brain.applyTransaction.mockImplementation(() => {
            mocks.calls.push(`apply:${state().past.length}`);
            return { success: true };
        });

        const { result } = renderHook(() => useMouth());

        await act(async () => {
            const res = await result.current.consumeGraph('x^2', 'LaTeX', true);
            expect(res.success).toBe(true);
        });

        expect(mocks.calls).toEqual(['clearAll:1', 'apply:1', 'apply:1']);
        expect(state().past).toEqual([]);
        expect(state().future).toEqual([]);
        expect(state().isRestoring).toBe(false);
    });

    it('LaTeX append keeps history', async () => {
        const { result } = renderHook(() => useMouth());

        await act(async () => {
            const res = await result.current.consumeGraph('x^2', 'LaTeX', false);
            expect(res.success).toBe(true);
        });

        expect(mocks.brain.clearAll).not.toHaveBeenCalled();
        expect(state().past.map(e => e.id)).toEqual(['project-a']);
    });
});
