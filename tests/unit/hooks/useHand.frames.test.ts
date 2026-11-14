/**
 * @vitest-environment jsdom
 *
 * docs/frame-integration.md §6.2 regression gaps (frames):
 * - confirmGrab attach math: absolute -> frame-relative, containment, smallest
 *   frame wins, frames never nest into frames.
 * - Nested SCALE/ROTATE: a child of a frame keeps the world position predicted
 *   by the coordinates helpers after live frame auto-fit moves the frame.
 *
 * Harness mirrors useHand.trace.test.ts: useCanvasProjection is identity, the
 * RF store is a plain nodes array, Brain/history are spies.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';

/*
 * The globals below are prefixed so they cannot collide with the declarations
 * in useHand.trace.test.ts (both files live in the same tsc project).
 */
declare global {
    // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
    var __frameRf: any;
    // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
    var __frameHistoryPush: any;
    // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
    var __frameApplyTransaction: any;
}

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => globalThis.__frameRf,
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
        applyTransaction: (...args: unknown[]) => globalThis.__frameApplyTransaction(...args),
    }),
}));

vi.mock('@/store/useHistoryStore', () => ({
    useHistoryStore: (selector: (s: unknown) => unknown) =>
        selector({
            interactionMode: 'IDLE',
            setInteractionMode: vi.fn(),
            push: (entry: unknown) => globalThis.__frameHistoryPush(entry),
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
import { indexNodes, toAbsolute } from '@/utils/coordinates';

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

beforeEach(() => {
    nodes = [];
    globalThis.__frameHistoryPush = vi.fn();
    globalThis.__frameApplyTransaction = vi.fn(() => ({ success: true }));
    rafQueue = [];
    globalThis.__frameRf = {
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

/** Grabs `id` at its current position and drops it `delta` flow units away. */
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
    const calls = globalThis.__frameApplyTransaction.mock.calls;
    const batch = calls[calls.length - 1][0] as { type: string; payload: Array<{ type: string; payload: any }> };
    expect(batch.type).toBe('BATCH');
    return batch.payload;
}

function movePayload(id: string): any {
    const move = lastBatch().find(tx => tx.type === 'MOVE_NODE' && tx.payload.id === id);
    expect(move).toBeDefined();
    return move!.payload;
}

describe('useHand.confirmGrab attach math', () => {
    it('attaches a root dropped fully inside a frame with frame-relative position', () => {
        nodes = makeNodes([
            { id: 'f1', type: 'frame', position: { x: 100, y: 50 }, selected: false, width: 300, height: 200 },
            { id: 'n1', position: { x: 500, y: 500 }, width: 50, height: 50 },
        ]);

        grabAndDrop('n1', { x: -250, y: -300 });

        // Dropped absolute top-left: (250, 200); frame absolute: (100, 50).
        expect(movePayload('n1')).toEqual({
            id: 'n1',
            position: { x: 150, y: 150 },
            parentId: 'f1',
        });
        const abs = toAbsolute(indexNodes(nodes), 'n1');
        expect(abs).toEqual({ x: 250, y: 200 });
    });

    it('does not attach a root that is only partially inside a frame', () => {
        nodes = makeNodes([
            { id: 'f1', type: 'frame', position: { x: 100, y: 50 }, selected: false, width: 300, height: 200 },
            { id: 'n1', position: { x: 500, y: 500 }, width: 50, height: 50 },
        ]);

        // Drops at (380, 210): inside on Y, right edge 430 > 400 so it hangs out.
        grabAndDrop('n1', { x: -120, y: -290 });

        const payload = movePayload('n1');
        expect(payload.parentId).toBeUndefined();
        expect(payload.position).toEqual({ x: 380, y: 210 });
    });

    it('attaches to the smallest frame when overlapping frames both contain the node', () => {
        nodes = makeNodes([
            { id: 'big', type: 'frame', position: { x: 0, y: 0 }, selected: false, width: 1000, height: 1000 },
            { id: 'small', type: 'frame', position: { x: 200, y: 200 }, selected: false, width: 200, height: 200 },
            { id: 'n1', position: { x: 800, y: 800 }, width: 50, height: 50 },
        ]);

        grabAndDrop('n1', { x: -550, y: -550 });

        // Absolute (250, 250) sits inside both; the 200x200 frame must win.
        expect(movePayload('n1')).toEqual({
            id: 'n1',
            position: { x: 50, y: 50 },
            parentId: 'small',
        });
    });

    it('never attaches a frame to another frame (no frame-in-frame)', () => {
        nodes = makeNodes([
            { id: 'host', type: 'frame', position: { x: 0, y: 0 }, selected: false, width: 600, height: 600 },
            { id: 'guest', type: 'frame', position: { x: 900, y: 900 }, width: 100, height: 100 },
        ]);

        grabAndDrop('guest', { x: -500, y: -500 });

        const payload = movePayload('guest');
        expect(payload.parentId).toBeUndefined();
        expect(payload.position).toEqual({ x: 400, y: 400 });
    });

    it('never attaches to a frame that is itself a child (single level)', () => {
        nodes = makeNodes([
            { id: 'outer', type: 'frame', position: { x: 0, y: 0 }, selected: false, width: 600, height: 600 },
            {
                id: 'inner',
                type: 'frame',
                position: { x: 100, y: 100 },
                parentId: 'outer',
                selected: false,
                width: 200,
                height: 200,
            },
            { id: 'n1', position: { x: 500, y: 500 }, width: 50, height: 50 },
        ]);

        grabAndDrop('n1', { x: -350, y: -350 });

        // The drop lands inside both frames, but only the root frame may parent.
        const payload = movePayload('n1');
        expect(payload.parentId).toBe('outer');
        expect(payload.position).toEqual({ x: 150, y: 150 });
    });

    it('keeps undo able to restore the pre-attach parent (root -> null)', () => {
        nodes = makeNodes([
            { id: 'f1', type: 'frame', position: { x: 100, y: 50 }, selected: false, width: 300, height: 200 },
            { id: 'n1', position: { x: 500, y: 500 }, width: 50, height: 50 },
        ]);

        grabAndDrop('n1', { x: -250, y: -300 });

        const entry = globalThis.__frameHistoryPush.mock.calls[0][0] as {
            inverse: Array<{ type: string; payload: any }>;
        };
        const inverseMove = entry.inverse.find(tx => tx.type === 'MOVE_NODE' && tx.payload.id === 'n1');
        expect(inverseMove!.payload).toEqual({
            id: 'n1',
            position: { x: 500, y: 500 },
            parentId: null,
        });
    });
});

describe('useHand nested SCALE/ROTATE keeps world positions', () => {
    function frameFixture() {
        return makeNodes([
            { id: 'f1', type: 'frame', position: { x: 100, y: 100 }, selected: false, width: 400, height: 300 },
            { id: 'c1', position: { x: 20, y: 20 }, parentId: 'f1', width: 50, height: 50 },
            { id: 'c2', position: { x: 150, y: 20 }, parentId: 'f1', width: 50, height: 50 },
        ]);
    }

    it('scales children about the absolute pivot; frame auto-fit does not shift them', () => {
        nodes = frameFixture();
        // Absolute child origins: c1 (120,120), c2 (250,120) -> pivot (185,120).
        const { result } = renderHook(() => useHand({ snap: false }));
        act(() => {
            useAppStore.getState().setMode('SCALING');
            result.current.startScale({ x: 300, y: 120 }); // 115px from pivot
        });
        rafQueue.length = 0;
        act(() => {
            result.current.handleMouseMove({ clientX: 415, clientY: 120, ctrlKey: false } as unknown as MouseEvent);
        });
        act(() => flushDragRaf());

        expect(useAppStore.getState().transformValue).toBe('2.00');

        const map = indexNodes(nodes);
        // 2x about (185,120).
        expect(toAbsolute(map, 'c1')).toEqual({ x: 55, y: 120 });
        expect(toAbsolute(map, 'c2')).toEqual({ x: 315, y: 120 });
        // Parent links are untouched by the transform.
        expect(nodes.find(n => n.id === 'c1')!.parentId).toBe('f1');
        expect(nodes.find(n => n.id === 'c2')!.parentId).toBe('f1');
    });

    it('rotates children about the absolute pivot; frame auto-fit does not shift them', () => {
        nodes = frameFixture();
        const { result } = renderHook(() => useHand({ snap: false }));
        act(() => {
            useAppStore.getState().setMode('ROTATING');
            result.current.startRotate({ x: 265, y: 120 }); // pivot + 80 on X -> angle 0
        });
        rafQueue.length = 0;
        act(() => {
            result.current.handleMouseMove({ clientX: 185, clientY: 200, ctrlKey: false } as unknown as MouseEvent);
        });
        act(() => flushDragRaf());

        expect(useAppStore.getState().transformValue).toBe('90.0°');

        const map = indexNodes(nodes);
        // +90° about (185,120): (x,y) -> (185 - (y-120), 120 + (x-185)).
        expect(toAbsolute(map, 'c1')).toEqual({ x: 185, y: 55 });
        expect(toAbsolute(map, 'c2')).toEqual({ x: 185, y: 185 });
        // Every child still resolves to a parent-local origin + frame origin.
        for (const id of ['c1', 'c2']) {
            const child = nodes.find(n => n.id === id)!;
            const frameAbs = toAbsolute(map, 'f1');
            const abs = toAbsolute(map, id);
            expect(abs).toEqual({
                x: frameAbs.x + child.position.x,
                y: frameAbs.y + child.position.y,
            });
        }
    });

    it('frame auto-fit keeps the child local origin consistent with its world origin', () => {
        nodes = makeNodes([
            { id: 'f1', type: 'frame', position: { x: 100, y: 100 }, selected: false, width: 400, height: 300 },
            { id: 'c1', position: { x: 20, y: 20 }, parentId: 'f1', width: 50, height: 50 },
            { id: 'c2', position: { x: 150, y: 20 }, parentId: 'f1', width: 50, height: 50 },
        ]);

        const { result } = renderHook(() => useHand({ snap: false }));
        act(() => {
            useAppStore.getState().setMode('SCALING');
            result.current.startScale({ x: 300, y: 120 });
        });
        rafQueue.length = 0;
        act(() => {
            result.current.handleMouseMove({ clientX: 185, clientY: 120, ctrlKey: false } as unknown as MouseEvent);
        });
        act(() => flushDragRaf());
        act(() => {
            result.current.confirmGrab();
        });

        const entry = globalThis.__frameHistoryPush.mock.calls[0][0] as {
            inverse: Array<{ type: string; payload: { id: string; parentId?: string | null } }>;
        };
        const inverseMoves = entry.inverse.filter(tx => tx.type === 'MOVE_NODE');
        for (const tx of inverseMoves) {
            if (tx.payload.id === 'c1' || tx.payload.id === 'c2') {
                expect(tx.payload.parentId).toBe('f1');
            }
        }
    });
});
