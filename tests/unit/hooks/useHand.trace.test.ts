/**
 * @vitest-environment jsdom
 *
 * B3: useHand trace harness (P0 blocker).
 *
 * Mocks: useReactFlow (nodesRef-backed get/setNodes), useCanvasProjection
 * (project() is identity — does NOT cover snapToGrid quantization, see §6.13#1),
 * useBrain, useHistoryStore, useClipboard, useSelection, useKnife.
 * Assertions: setTransformValue (via real useAppStore) + node positions.
 * snap-off branches must stay bit-identical after the P0-1 change.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';

declare global {
    // eslint-disable-next-line no-var
    var __rf: {
        getNodes: () => Node[];
        setNodes: (updater: (nds: Node[]) => Node[]) => void;
        getViewport: () => { x: number; y: number; zoom: number };
        setViewport: ReturnType<typeof vi.fn>;
    };
    // eslint-disable-next-line no-var
    var __knife: {
        cutPath: { x: number; y: number }[];
        startCut: ReturnType<typeof vi.fn>;
        updateCut: ReturnType<typeof vi.fn>;
        endCut: ReturnType<typeof vi.fn>;
        cancelCut: ReturnType<typeof vi.fn>;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var __historyPush: any;
}

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => globalThis.__rf,
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
        applyTransaction: vi.fn(() => ({ success: true })),
    }),
}));

vi.mock('@/store/useHistoryStore', () => ({
    useHistoryStore: (selector: (s: unknown) => unknown) =>
        selector({
            interactionMode: 'IDLE',
            setInteractionMode: vi.fn(),
            push: (entry: unknown) => globalThis.__historyPush(entry),
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
    useKnife: () => globalThis.__knife,
}));

import { useHand } from '@/hooks/nerves/useHand';
import { useAppStore } from '@/store/useStore';

function makeNodes(specs: Array<{
    id: string;
    position: { x: number; y: number };
    parentId?: string;
    selected?: boolean;
}>): Node[] {
    return specs.map((s) => ({
        id: s.id,
        type: 'test',
        position: { ...s.position },
        parentId: s.parentId,
        selected: s.selected ?? true,
        data: {},
    }));
}

let nodes: Node[];
let rafQueue: Array<() => void>;

function flushDragRaf() {
    // Run exactly one snapshot of queued rAF callbacks; discard autopan
    // reschedules pushed during the flush (they must not run synchronously).
    const pending = rafQueue.splice(0, rafQueue.length);
    for (const cb of pending) cb();
    rafQueue.length = 0;
}

function mouseEvent(button: number, ctrlKey: boolean): MouseEvent {
    const target = {
        closest: () => null,
        classList: { contains: () => false },
        tagName: 'DIV',
        getAttribute: () => null,
    };
    return { button, ctrlKey, clientX: 0, clientY: 0, target } as unknown as MouseEvent;
}

beforeEach(() => {
    nodes = makeNodes([{ id: 'n1', position: { x: 100, y: 100 } }]);
    globalThis.__historyPush = vi.fn();
    rafQueue = [];
    globalThis.__rf = {
        getNodes: () => nodes,
        setNodes: (updater: (nds: Node[]) => Node[]) => {
            nodes = updater(nodes);
        },
        getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
        setViewport: vi.fn(),
    };
    const cutPath: { x: number; y: number }[] = [];
    globalThis.__knife = {
        cutPath,
        startCut: vi.fn((p: { x: number; y: number }) => {
            cutPath.push(p);
        }),
        updateCut: vi.fn(),
        endCut: vi.fn(() => {
            cutPath.length = 0;
        }),
        cancelCut: vi.fn(() => {
            cutPath.length = 0;
        }),
    };
    (globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame =
        ((cb: () => void) => {
            rafQueue.push(cb);
            return rafQueue.length;
        }) as unknown as typeof requestAnimationFrame;
    (globalThis as unknown as { cancelAnimationFrame: typeof cancelAnimationFrame }).cancelAnimationFrame =
        (() => {}) as unknown as typeof cancelAnimationFrame;
    act(() => {
        useAppStore.getState().setMode('IDLE');
        useAppStore.getState().setTransformValue('');
    });
});

function driveGrab(fixture: {
    snap: boolean;
    axisLock?: 'X' | 'Y' | null;
    transformBuffer?: string;
    startFlowPos: { x: number; y: number };
    events: Array<{ mouse: { x: number; y: number }; ctrl: boolean }>;
}) {
    const { result } = renderHook(({ snap }) => useHand({ snap }), { initialProps: { snap: fixture.snap } });
    act(() => {
        useAppStore.getState().setMode('GRABBING');
    });
    act(() => {
        result.current.startGrab({ ...fixture.startFlowPos }, false, undefined, true);
    });
    // Axis lock / numeric input happen DURING the grab (startGrab resets axisLock).
    if (fixture.axisLock) act(() => result.current.setAxisLock(fixture.axisLock ?? null));
    if (fixture.transformBuffer) {
        for (const ch of fixture.transformBuffer) act(() => result.current.handleTypeNum(ch));
    }
    for (const ev of fixture.events) {
        // Drop stale autopan callbacks queued before this event: in a real
        // browser they would have fired frames ago. Only the drag-throttle
        // callback scheduled by this mousemove may run.
        rafQueue.length = 0;
        act(() => {
            result.current.handleMouseMove({ clientX: ev.mouse.x, clientY: ev.mouse.y, ctrlKey: ev.ctrl } as unknown as MouseEvent);
        });
        act(() => flushDragRaf());
    }
    return result;
}

describe('B3 hand trace: GRABBING', () => {
    it('grab-no-ctrl is bit-identical (no snap)', () => {
        driveGrab({ snap: false, startFlowPos: { x: 100, y: 100 }, events: [{ mouse: { x: 137, y: 87 }, ctrl: false }] });
        expect(useAppStore.getState().transformValue).toBe('37, -13');
        expect(nodes[0].position).toEqual({ x: 137, y: 87 });
    });

    it('grab-ctrl snaps to 20px grid', () => {
        driveGrab({ snap: false, startFlowPos: { x: 100, y: 100 }, events: [{ mouse: { x: 137, y: 87 }, ctrl: true }] });
        expect(useAppStore.getState().transformValue).toBe('40, -20');
        expect(nodes[0].position).toEqual({ x: 140, y: 80 });
    });

    it('grab-manualSnap snaps without Ctrl', () => {
        driveGrab({ snap: true, startFlowPos: { x: 100, y: 100 }, events: [{ mouse: { x: 137, y: 87 }, ctrl: false }] });
        expect(useAppStore.getState().transformValue).toBe('40, -20');
        expect(nodes[0].position).toEqual({ x: 140, y: 80 });
    });

    it('grab-axisLock-X snaps locked axis only', () => {
        driveGrab({
            snap: false,
            axisLock: 'X',
            startFlowPos: { x: 100, y: 100 },
            events: [{ mouse: { x: 137, y: 87 }, ctrl: true }],
        });
        expect(useAppStore.getState().transformValue).toBe('40');
        expect(nodes[0].position).toEqual({ x: 140, y: 100 });
    });

    it('grab-transformBuffer early-returns (mouse ignored, typed value kept)', () => {
        const result = driveGrab({
            snap: false,
            transformBuffer: '5',
            startFlowPos: { x: 100, y: 100 },
            events: [{ mouse: { x: 137, y: 87 }, ctrl: true }],
        });
        // Typing '5' itself applies dx=5 via the numeric-input effect...
        expect(nodes[0].position).toEqual({ x: 105, y: 100 });
        // ...but the subsequent mouse move must NOT snap/overwrite it.
        expect(useAppStore.getState().transformValue).toBe('5');
        expect(result.current).toBeDefined();
    });

    it('autopan-ctrl: snap from closure applies when event has no Ctrl', () => {
        // autopan calls updateInteraction(mousePos) without ctrlKey; the snap
        // option (from effectiveSnap) must still quantize.
        driveGrab({ snap: true, startFlowPos: { x: 100, y: 100 }, events: [{ mouse: { x: 137, y: 87 }, ctrl: false }] });
        expect(useAppStore.getState().transformValue).toBe('40, -20');
        expect(nodes[0].position).toEqual({ x: 140, y: 80 });
    });
});

describe('B3 hand trace: SCALING / ROTATING', () => {
    it('scale-ctrl snaps to 0.05 step', () => {
        nodes = makeNodes([
            { id: 'n1', position: { x: 100, y: 100 } },
            { id: 'n2', position: { x: 200, y: 100 } },
        ]);
        const { result } = renderHook(({ snap }) => useHand({ snap }), { initialProps: { snap: true } });
        act(() => {
            useAppStore.getState().setMode('SCALING');
        });
        act(() => {
            result.current.startScale({ x: 130, y: 100 });
        });
        rafQueue.length = 0;
        act(() => {
            result.current.handleMouseMove({ clientX: 139.6, clientY: 100, ctrlKey: true } as unknown as MouseEvent);
        });
        act(() => flushDragRaf());
        expect(useAppStore.getState().transformValue).toBe('0.50');
        const n1 = nodes.find((n) => n.id === 'n1')!;
        expect(n1.position.x).toBeCloseTo(125, 5);
        expect(n1.position.y).toBeCloseTo(100, 5);
    });

    it('rotate-ctrl snaps to 15deg, keeps raw winding', () => {
        nodes = makeNodes([
            { id: 'n1', position: { x: 100, y: 100 } },
            { id: 'n2', position: { x: 200, y: 100 } },
        ]);
        const { result } = renderHook(({ snap }) => useHand({ snap }), { initialProps: { snap: true } });
        act(() => {
            useAppStore.getState().setMode('ROTATING');
        });
        act(() => {
            result.current.startRotate({ x: 250, y: 100 });
        });
        rafQueue.length = 0;
        act(() => {
            result.current.handleMouseMove({ clientX: 163.9, clientY: 199.03, ctrlKey: true } as unknown as MouseEvent);
        });
        act(() => flushDragRaf());
        expect(useAppStore.getState().transformValue).toBe('75.0°');
        const n1 = nodes.find((n) => n.id === 'n1')!;
        expect(n1.position.x).toBeCloseTo(137.06, 1);
        expect(n1.position.y).toBeCloseTo(51.7, 1);
    });
});

describe('B3 hand trace: nested transforms', () => {
    it('moves only the parent when parent and child are both selected', () => {
        nodes = makeNodes([
            { id: 'parent', position: { x: 100, y: 100 } },
            { id: 'child', position: { x: 10, y: 10 }, parentId: 'parent' },
        ]);
        const { result } = renderHook(({ snap }) => useHand({ snap }), { initialProps: { snap: false } });
        act(() => {
            useAppStore.getState().setMode('GRABBING');
            result.current.startGrab({ x: 100, y: 100 }, false, undefined, true);
        });
        rafQueue.length = 0;
        act(() => {
            result.current.handleMouseMove({ clientX: 137, clientY: 87, ctrlKey: false } as unknown as MouseEvent);
        });
        act(() => flushDragRaf());

        const parent = nodes.find((n) => n.id === 'parent')!;
        const child = nodes.find((n) => n.id === 'child')!;
        expect(parent.position).toEqual({ x: 137, y: 87 });
        expect(child.position).toEqual({ x: 10, y: 10 });
    });

    it('writes a scaled child back to parent-local coordinates', () => {
        nodes = makeNodes([
            { id: 'parent', position: { x: 100, y: 100 }, selected: false },
            { id: 'c1', position: { x: 10, y: 10 }, parentId: 'parent' },
            { id: 'c2', position: { x: 50, y: 10 }, parentId: 'parent' },
        ]);
        const { result } = renderHook(({ snap }) => useHand({ snap }), { initialProps: { snap: false } });
        act(() => {
            useAppStore.getState().setMode('SCALING');
            result.current.startScale({ x: 150, y: 110 });
        });
        rafQueue.length = 0;
        act(() => {
            result.current.handleMouseMove({ clientX: 170, clientY: 110, ctrlKey: false } as unknown as MouseEvent);
        });
        act(() => flushDragRaf());

        const c1 = nodes.find((n) => n.id === 'c1')!;
        const c2 = nodes.find((n) => n.id === 'c2')!;
        // World: c1 110 -> 90, c2 150 -> 170; parent stays at 100.
        expect(c1.position.x).toBeCloseTo(-10, 5);
        expect(c2.position.x).toBeCloseTo(70, 5);
        expect(c1.position.y).toBeCloseTo(10, 5);
        expect(c2.position.y).toBeCloseTo(10, 5);

        // The grab/scale undo payload must keep the children attached.
        act(() => result.current.confirmGrab());
        const entry = globalThis.__historyPush.mock.calls[0]?.[0] as {
            inverse: Array<{ type: string; payload: { id: string; parentId?: string } }>;
        };
        const inverseMoves = entry.inverse.filter(t => t.type === 'MOVE_NODE');
        expect(inverseMoves.map(t => t.payload.id).sort()).toEqual(['c1', 'c2']);
        for (const tx of inverseMoves) {
            expect(tx.payload.parentId).toBe('parent');
        }
    });
});

describe('B3 hand trace: ctrl-rightclick resolver', () => {
    it('ctrl-rightclick-idle enters CUTTING', () => {
        const { result } = renderHook(() => useHand({ snap: false }));
        act(() => {
            useAppStore.getState().setMode('IDLE');
        });
        act(() => {
            result.current.handleMouseDown(mouseEvent(2, true));
        });
        expect(useAppStore.getState().mode).toBe('CUTTING');
        expect(globalThis.__knife.startCut).toHaveBeenCalledTimes(1);
    });

    it('ctrl-rightclick-grabbing cancels and clears cutPath', () => {
        const { result } = renderHook(() => useHand({ snap: false }));
        act(() => {
            result.current.startGrab({ x: 100, y: 100 }, false, undefined, true);
        });
        expect(useAppStore.getState().mode).toBe('GRABBING');
        globalThis.__knife.cutPath.push({ x: 1, y: 1 });
        act(() => {
            result.current.handleMouseDown(mouseEvent(2, true));
        });
        expect(useAppStore.getState().mode).toBe('IDLE');
        expect(globalThis.__knife.cancelCut).toHaveBeenCalledTimes(1);
        expect(globalThis.__knife.cutPath).toHaveLength(0);
        expect(globalThis.__knife.startCut).not.toHaveBeenCalled();
    });
});
