/**
 * @vitest-environment jsdom
 *
 * useHistoryExecutor: 執行守門 (read-only / 互動中 / 輸入焦點) 與失敗語意。
 * 硬失敗時不得動 UI 或搬移歷史；「Node not found」則視為可容忍並照常套用。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';
import type { HistoryEntry } from '@/store/useHistoryStore';

const mocks = vi.hoisted(() => {
    const brain = {
        isReconnecting: false,
        isResizing: false,
        applyTransaction: vi.fn<
            (tx: unknown, silent?: boolean) => { success: boolean; reason?: string }
        >(() => ({ success: true })),
        getEdges: vi.fn<() => unknown[]>(() => []),
    };
    return {
        brain,
        getNodes: vi.fn<() => unknown[]>(() => []),
        setNodes: vi.fn<(nodes: unknown) => void>(),
        setEdges: vi.fn<(edges: unknown) => void>(),
    };
});

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => ({
            getNodes: mocks.getNodes,
            getEdges: () => [],
            setNodes: mocks.setNodes,
            setEdges: mocks.setEdges,
        }),
        // 沒有拖曳中的連線：connectionNodeId 為 undefined。
        useStore: (selector: (state: { connectionNodeId?: string }) => unknown) =>
            selector({ connectionNodeId: undefined }),
    };
});

vi.mock('@/context/BrainContext', () => ({
    useBrain: () => mocks.brain,
}));

import { useHistoryExecutor, withForcedMoves } from '@/hooks/useHistoryExecutor';
import { useHistoryStore } from '@/store/useHistoryStore';

const makeNode = (): Node => ({
    id: 'a',
    type: 'mathNode',
    position: { x: 99, y: 99 },
    data: { label: 'A' },
}) as unknown as Node;

const moveEntry = (): HistoryEntry => ({
    id: 'move-a',
    description: 'Move A',
    forward: [{ type: 'MOVE_NODE', payload: { id: 'a', position: { x: 10, y: 20 } } }],
    inverse: [{ type: 'MOVE_NODE', payload: { id: 'a', position: { x: 0, y: 0 } } }],
});

const seedPast = (entry: HistoryEntry) => {
    useHistoryStore.setState({ past: [entry], future: [] });
};

const seedFuture = (entry: HistoryEntry) => {
    useHistoryStore.setState({ past: [], future: [entry] });
};

const positionsFrom = (call: unknown): Array<{ x: number; y: number }> => {
    const nodes = call as Node[];
    return nodes.map(n => ({ ...n.position }));
};

describe('useHistoryExecutor', () => {
    beforeEach(() => {
        useHistoryStore.setState({
            past: [],
            future: [],
            isRestoring: false,
            interactionMode: 'IDLE',
        });

        mocks.brain.isReconnecting = false;
        mocks.brain.isResizing = false;
        mocks.brain.applyTransaction.mockReset();
        mocks.brain.applyTransaction.mockReturnValue({ success: true });
        mocks.brain.getEdges.mockReturnValue([]);

        mocks.getNodes.mockReturnValue([makeNode()]);
        mocks.setNodes.mockClear();
        mocks.setEdges.mockClear();

        document.body.innerHTML = '';
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('read-only refuses undo without touching the stacks', () => {
        seedPast(moveEntry());
        const { result } = renderHook(() => useHistoryExecutor({ isReadOnly: true }));

        expect(result.current.canUndo).toBe(true);

        act(() => {
            result.current.undo();
        });

        expect(mocks.brain.applyTransaction).not.toHaveBeenCalled();
        expect(mocks.setNodes).not.toHaveBeenCalled();
        expect(mocks.setEdges).not.toHaveBeenCalled();
        expect(useHistoryStore.getState().past).toHaveLength(1);
        expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it('refuses undo while interactionMode is not IDLE', () => {
        seedPast(moveEntry());
        useHistoryStore.setState({ interactionMode: 'GRABBING' });
        const { result } = renderHook(() => useHistoryExecutor());

        act(() => {
            result.current.undo();
        });

        expect(mocks.brain.applyTransaction).not.toHaveBeenCalled();
        expect(mocks.setNodes).not.toHaveBeenCalled();
        expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it('refuses undo while a brain reconnect or resize is in flight', () => {
        seedPast(moveEntry());
        mocks.brain.isReconnecting = true;
        const { result } = renderHook(() => useHistoryExecutor());

        act(() => {
            result.current.undo();
        });

        mocks.brain.isReconnecting = false;
        mocks.brain.isResizing = true;
        act(() => {
            result.current.undo();
        });

        expect(mocks.brain.applyTransaction).not.toHaveBeenCalled();
        expect(useHistoryStore.getState().past).toHaveLength(1);
    });

    it('refuses undo while an INPUT has focus (native undo wins)', () => {
        seedPast(moveEntry());
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        expect(document.activeElement).toBe(input);

        const { result } = renderHook(() => useHistoryExecutor());

        act(() => {
            result.current.undo();
        });

        expect(mocks.brain.applyTransaction).not.toHaveBeenCalled();
        expect(mocks.setNodes).not.toHaveBeenCalled();
        expect(useHistoryStore.getState().past).toHaveLength(1);

        input.blur();
        input.remove();
    });

    it('hard failure keeps the entry in past and never applies UI', () => {
        seedPast(moveEntry());
        mocks.brain.applyTransaction.mockReturnValue({
            success: false,
            reason: 'Handle already connected',
        });
        const { result } = renderHook(() => useHistoryExecutor());

        act(() => {
            result.current.undo();
        });

        expect(mocks.setNodes).not.toHaveBeenCalled();
        expect(mocks.setEdges).not.toHaveBeenCalled();

        const state = useHistoryStore.getState();
        expect(state.past.map(e => e.id)).toEqual(['move-a']);
        expect(state.future).toEqual([]);
        expect(state.isRestoring).toBe(false);
        expect(console.warn).toHaveBeenCalledWith(
            '[History] Refused:',
            'Handle already connected'
        );
    });

    it('treats "Node not found" as tolerated: applies UI and moves past -> future', () => {
        seedPast(moveEntry());
        mocks.brain.applyTransaction.mockReturnValue({
            success: false,
            reason: 'Node not found',
        });
        const { result } = renderHook(() => useHistoryExecutor());

        act(() => {
            result.current.undo();
        });

        expect(mocks.setNodes).toHaveBeenCalledTimes(1);
        expect(positionsFrom(mocks.setNodes.mock.calls[0][0])).toEqual([{ x: 0, y: 0 }]);
        expect(mocks.setEdges).toHaveBeenCalledTimes(1);

        const state = useHistoryStore.getState();
        expect(state.past).toEqual([]);
        expect(state.future.map(e => e.id)).toEqual(['move-a']);
        expect(state.isRestoring).toBe(false);
    });

    it('successful undo moves the entry past -> future and applies the inverse', () => {
        seedPast(moveEntry());
        const { result } = renderHook(() => useHistoryExecutor());

        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);

        act(() => {
            result.current.undo();
        });

        expect(mocks.brain.applyTransaction).toHaveBeenCalledWith(
            { type: 'BATCH', payload: withForcedMoves(moveEntry().inverse) },
            true
        );
        expect(positionsFrom(mocks.setNodes.mock.calls[0][0])).toEqual([{ x: 0, y: 0 }]);

        const state = useHistoryStore.getState();
        expect(state.past).toEqual([]);
        expect(state.future.map(e => e.id)).toEqual(['move-a']);
        expect(state.isRestoring).toBe(false);
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(true);
    });

    it('successful redo moves the entry future -> past and applies the forward', () => {
        seedFuture(moveEntry());
        const { result } = renderHook(() => useHistoryExecutor());

        expect(result.current.canRedo).toBe(true);

        act(() => {
            result.current.redo();
        });

        expect(mocks.brain.applyTransaction).toHaveBeenCalledWith(
            { type: 'BATCH', payload: withForcedMoves(moveEntry().forward) },
            true
        );
        expect(positionsFrom(mocks.setNodes.mock.calls[0][0])).toEqual([{ x: 10, y: 20 }]);

        const state = useHistoryStore.getState();
        expect(state.past.map(e => e.id)).toEqual(['move-a']);
        expect(state.future).toEqual([]);
        expect(state.isRestoring).toBe(false);
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);
    });

    it('failed redo returns the entry to future, not past', () => {
        seedFuture(moveEntry());
        mocks.brain.applyTransaction.mockReturnValue({
            success: false,
            reason: 'Invalid coordinates',
        });
        const { result } = renderHook(() => useHistoryExecutor());

        act(() => {
            result.current.redo();
        });

        expect(mocks.setNodes).not.toHaveBeenCalled();
        const state = useHistoryStore.getState();
        expect(state.past).toEqual([]);
        expect(state.future.map(e => e.id)).toEqual(['move-a']);
    });
});
