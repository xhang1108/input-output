/**
 * @vitest-environment jsdom
 *
 * Attach-path hierarchy guard: `confirmGrab` must reject an attach that would
 * create depth > 1 (a candidate that already owns children) or use a non-root
 * frame as the parent. Valid attaches stay unchanged.
 *
 * Harness mirrors useHand.trace.test.ts, with unique global names so the
 * existing test files keep their own declarations.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';

declare global {
    // eslint-disable-next-line no-var
    var __hierRf: {
        getNodes: () => Node[];
        setNodes: (updater: (nds: Node[]) => Node[]) => void;
        getViewport: () => { x: number; y: number; zoom: number };
        setViewport: ReturnType<typeof vi.fn>;
    };
    // eslint-disable-next-line no-var
    var __hierHistoryPush: any;
    // eslint-disable-next-line no-var
    var __hierApplyTransaction: any;
}

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => globalThis.__hierRf,
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
        applyTransaction: (...args: unknown[]) => globalThis.__hierApplyTransaction(...args),
    }),
}));

vi.mock('@/store/useHistoryStore', () => ({
    useHistoryStore: (selector: (s: unknown) => unknown) =>
        selector({
            interactionMode: 'IDLE',
            setInteractionMode: vi.fn(),
            push: (entry: unknown) => globalThis.__hierHistoryPush(entry),
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

type Spec = {
    id: string;
    position: { x: number; y: number };
    parentId?: string;
    selected?: boolean;
    type?: string;
    width?: number;
    height?: number;
};

function makeNodes(specs: Spec[]): Node[] {
    return specs.map((s) => ({
        id: s.id,
        type: s.type ?? 'test',
        position: { ...s.position },
        parentId: s.parentId,
        selected: s.selected ?? true,
        width: s.width,
        height: s.height,
        measured: {
            width: s.width ?? (s.type === 'frame' ? 200 : undefined),
            height: s.height ?? (s.type === 'frame' ? 100 : undefined),
        },
        data: {
            width: s.width ?? (s.type === 'frame' ? 200 : undefined),
            height: s.height ?? (s.type === 'frame' ? 100 : undefined),
        },
    }));
}

let nodes: Node[];
let rafQueue: Array<() => void>;

function flushDragRaf() {
    const pending = rafQueue.splice(0, rafQueue.length);
    for (const cb of pending) cb();
    rafQueue.length = 0;
}

function grabAndDrop(id: string, delta: { x: number; y: number }) {
    const start = nodes.find(n => n.id === id)!.position;
    const { result } = renderHook(() => useHand({ snap: false }));
    act(() => {
        useAppStore.getState().setMode('GRABBING');
        result.current.startGrab({ x: start.x, y: start.y }, false, undefined, true);
    });
    rafQueue.length = 0;
    act(() => {
        result.current.handleMouseMove({
            clientX: start.x + delta.x,
            clientY: start.y + delta.y,
            ctrlKey: false,
        } as unknown as MouseEvent);
    });
    act(() => flushDragRaf());
    act(() => {
        result.current.confirmGrab();
    });
    return result;
}

function lastBatch(): Array<{ type: string; payload: any }> {
    const calls = globalThis.__hierApplyTransaction.mock.calls;
    const batch = calls[calls.length - 1][0] as { type: string; payload: Array<{ type: string; payload: any }> };
    expect(batch.type).toBe('BATCH');
    return batch.payload;
}

function movePayload(id: string): any {
    const move = lastBatch().find(tx => tx.type === 'MOVE_NODE' && tx.payload.id === id);
    expect(move).toBeDefined();
    return move!.payload;
}

beforeEach(() => {
    nodes = [];
    rafQueue = [];
    globalThis.__hierHistoryPush = vi.fn();
    globalThis.__hierApplyTransaction = vi.fn(() => ({ success: true }));
    globalThis.__hierRf = {
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

describe('useHand.confirmGrab attach validation', () => {
    it('rejects an attach that would push an existing child to depth 2', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        nodes = makeNodes([
            { id: 'f1', type: 'frame', position: { x: 0, y: 0 }, selected: false, width: 400, height: 400 },
            { id: 'n1', position: { x: 500, y: 500 }, width: 50, height: 50 },
            { id: 'c1', position: { x: 10, y: 10 }, parentId: 'n1', width: 20, height: 20 },
        ]);

        grabAndDrop('n1', { x: -400, y: -400 });

        const payload = movePayload('n1');
        expect(payload.parentId).toBeUndefined();
        expect(payload.position).toEqual({ x: 100, y: 100 });
        expect(warn.mock.calls.some(args => String(args[0]).includes('Attach rejected'))).toBe(true);

        warn.mockRestore();
    });

    it('still attaches a childless root into a root frame', () => {
        nodes = makeNodes([
            { id: 'f1', type: 'frame', position: { x: 0, y: 0 }, selected: false, width: 400, height: 400 },
            { id: 'n1', position: { x: 500, y: 500 }, width: 50, height: 50 },
        ]);

        grabAndDrop('n1', { x: -400, y: -400 });

        expect(movePayload('n1')).toEqual({
            id: 'n1',
            position: { x: 100, y: 100 },
            parentId: 'f1',
        });
    });

    it('never uses a frame that already has a parent as the attach target', () => {
        nodes = makeNodes([
            { id: 'host', type: 'frame', position: { x: 0, y: 0 }, selected: false, width: 200, height: 200 },
            { id: 'guest', type: 'frame', position: { x: 1000, y: 1000 }, parentId: 'host', selected: false, width: 300, height: 300 },
            { id: 'n1', position: { x: 2000, y: 2000 }, width: 50, height: 50 },
        ]);

        grabAndDrop('n1', { x: -950, y: -950 });

        const payload = movePayload('n1');
        expect(payload.parentId).toBeUndefined();
        expect(payload.position).toEqual({ x: 1050, y: 1050 });
    });
});
