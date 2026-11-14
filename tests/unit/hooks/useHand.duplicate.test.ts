/**
 * @vitest-environment jsdom
 *
 * Shift+D duplicates and immediately hands the new nodes to `startGrab` before
 * the Brain transaction has been projected into the React Flow store. The grab
 * must still start and move the duplicates when the mouse moves.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';

declare global {
    // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
    var __dupRf: any;
    // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
    var __dupApplyTransaction: any;
}

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => globalThis.__dupRf,
    };
});

vi.mock('@/hooks/useCanvasProjection', () => ({
    useCanvasProjection: () => ({ project: (p: { x: number; y: number }) => ({ ...p }) }),
}));

vi.mock('@/context/BrainContext', () => ({
    useBrain: () => ({
        getPhysicsConfig: () => ({
            interaction: { snapGridSize: 20, dragThreshold: 5, autoPanPadding: 100, autoPanBaseSpeed: 20 },
        }),
        setInteracting: vi.fn(),
        getNodesMap: () => new Map(),
        applyTransaction: (...args: unknown[]) => globalThis.__dupApplyTransaction(...args),
    }),
}));

vi.mock('@/store/useHistoryStore', () => ({
    useHistoryStore: (selector: (s: unknown) => unknown) =>
        selector({
            interactionMode: 'IDLE',
            setInteractionMode: vi.fn(),
            push: vi.fn(),
            isRestoring: false,
            setIsRestoring: vi.fn(),
        }),
}));

vi.mock('@/hooks/useClipboard', () => ({
    useClipboard: () => ({
        duplicateSelected: vi.fn(),
        copyToClipboard: vi.fn(),
        pasteFromClipboard: vi.fn(),
    }),
}));

vi.mock('@/hooks/useSelection', () => ({
    useSelection: () => ({
        deleteSelected: vi.fn(),
        resetSelected: vi.fn(),
        detachSelected: vi.fn(),
        swapConnections: vi.fn(),
        alignSelectedNodes: vi.fn(),
        clearSelection: vi.fn(),
        selectNode: vi.fn(),
    }),
}));

vi.mock('@/hooks/useKnife', () => ({
    useKnife: () => ({
        cutPath: [],
        startCut: vi.fn(),
        updateCut: vi.fn(),
        endCut: vi.fn(),
        cancelCut: vi.fn(),
    }),
}));

import { useHand } from '@/hooks/nerves/useHand';
import { useAppStore } from '@/store/useStore';

let nodes: Node[];
let rafQueue: Array<() => void>;

const makeNode = (id: string, x: number, y: number, selected = false): Node => ({
    id,
    type: 'test',
    position: { x, y },
    selected,
    data: {},
} as unknown as Node);

function flushDragRaf() {
    const pending = rafQueue.splice(0, rafQueue.length);
    for (const cb of pending) cb();
}

beforeEach(() => {
    nodes = [];
    rafQueue = [];
    globalThis.__dupApplyTransaction = vi.fn(() => ({ success: true }));
    globalThis.__dupRf = {
        getNodes: () => nodes,
        setNodes: (updater: (nds: Node[]) => Node[]) => {
            nodes = updater(nodes);
        },
        getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
        setViewport: vi.fn(),
    };
    const g = globalThis as unknown as {
        requestAnimationFrame: typeof requestAnimationFrame;
        cancelAnimationFrame: typeof cancelAnimationFrame;
    };
    g.requestAnimationFrame = ((cb: () => void) => {
        rafQueue.push(cb);
        return rafQueue.length;
    }) as unknown as typeof requestAnimationFrame;
    g.cancelAnimationFrame = (() => {}) as unknown as typeof cancelAnimationFrame;
    act(() => {
        useAppStore.getState().setMode('IDLE');
        useAppStore.getState().setTransformValue('');
    });
});

describe('useHand duplicate grab', () => {
    it('starts a grab for override nodes that are not in the store yet', () => {
        nodes = [makeNode('n1', 100, 100, true)];
        const copy = makeNode('n1-copy', 120, 120, true);

        const { result } = renderHook(() => useHand({ snap: false }));
        act(() => {
            result.current.startGrab({ x: 100, y: 100 }, false, [copy], true);
        });

        expect(useAppStore.getState().mode).toBe('GRABBING');

        // The Brain projection lands after the grab started; the duplicate then
        // follows the mouse delta instead of staying at the paste offset.
        nodes = [...nodes, copy];
        act(() => {
            result.current.handleMouseMove({
                clientX: 150,
                clientY: 100,
                ctrlKey: false,
            } as unknown as MouseEvent);
        });
        act(() => flushDragRaf());

        expect(nodes.find(n => n.id === 'n1-copy')!.position).toEqual({ x: 170, y: 120 });
    });
});
