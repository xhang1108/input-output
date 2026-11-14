/**
 * @vitest-environment jsdom
 *
 * docs/frame-integration.md §6.2 regression gaps that are not pure math:
 * - Backspace/delete ownership: React Flow must not own node removal
 *   (`deleteKeyCode={null}`), and `onNodesChangeSafe` must never translate RF
 *   remove changes into a second removal next to `deleteSelected`.
 * - Read-only: frame commands are blocked at the FlowCanvas command surface.
 * - Depth ordering: parent/grandparent before descendants for sort + delete
 *   undo payloads.
 *
 * The React Flow canvas is a 900-line component with no render harness here,
 * so the ownership/read-only cases are source-level guards (same approach as
 * tests/unit/hooks/useCanvasProjection.lock.test.ts).
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Node } from '@xyflow/react';
import { sortParentFirst, type CoordinateNode } from '@/utils/coordinates';
import { computeNextState } from '@/hooks/useHistoryExecutor';

const read = (p: string) => readFileSync(`${process.cwd()}/${p}`, 'utf8');

/* ------------------------------------------------------------------ */
/* Source-level guards: Backspace / remove ownership                   */
/* ------------------------------------------------------------------ */

describe('Backspace / delete ownership (source guards)', () => {
    const flowCanvas = read('src/components/FlowCanvas.tsx');

    function region(start: string, end: string): string {
        const from = flowCanvas.indexOf(start);
        const to = flowCanvas.indexOf(end, from + start.length);
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to).toBeGreaterThan(from);
        return flowCanvas.slice(from, to);
    }

    it('React Flow delete key is disabled (deleteKeyCode={null})', () => {
        expect(flowCanvas).toContain('deleteKeyCode={null}');
        // No other deleteKeyCode assignment may sneak back in.
        const assignments = flowCanvas.match(/deleteKeyCode=\{[^}]*\}/g) ?? [];
        expect(assignments).toEqual(['deleteKeyCode={null}']);
    });

    it('onNodesChangeSafe never emits a node removal (Brain owns delete)', () => {
        const body = region('const onNodesChangeSafe', 'const onEdgesChangeSafe');

        expect(body).toContain("c.type === 'select'");
        expect(body).not.toContain('REMOVE_NODE');
        expect(body).not.toContain('deleteElements');
        expect(body).not.toContain("case 'remove'");
        // The only 'remove' reference is the read-only destructive-change bail-out.
        const removeMentions = body.match(/'remove'/g) ?? [];
        expect(removeMentions).toHaveLength(1);
    });

    it('node deletion goes through the command, not React Flow element deletion', () => {
        const bundle = region("'nodes:delete':", "'nodes:delete-alt':");
        expect(bundle).toContain('deleteSelected()');
        expect(flowCanvas).not.toContain('deleteElements');
    });
});

/* ------------------------------------------------------------------ */
/* Read-only command surface                                           */
/* ------------------------------------------------------------------ */

describe('read-only frame commands (source guards)', () => {
    const flowCanvas = read('src/components/FlowCanvas.tsx');

    function region(start: string, end: string): string {
        const from = flowCanvas.indexOf(start);
        const to = flowCanvas.indexOf(end, from + start.length);
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to).toBeGreaterThan(from);
        return flowCanvas.slice(from, to);
    }

    it('F (group/ungroup) is guarded', () => {
        const handler = region("'nodes:bundle':", "'nodes:duplicate':");
        expect(handler).toContain('if (isReadOnly) return;');
    });

    it('Delete is guarded on both delete shortcuts', () => {
        expect(region("'nodes:delete':", "'nodes:delete-alt':")).toContain('if (isReadOnly) return;');
        expect(region("'nodes:delete-alt':", "'selection:all':")).toContain('if (isReadOnly) return;');
    });

    it('transform commands that also move frame children are guarded', () => {
        expect(region("'transform:grab':", "'transform:scale':")).toContain('if (isReadOnly) return;');
        expect(region("'transform:scale':", "'transform:rotate':")).toContain('if (isReadOnly) return;');
        expect(region("'transform:rotate':", "'nodes:bundle':")).toContain('if (isReadOnly) return;');
    });

    it('guards the canvas context menu Delete and Detach actions', () => {
        const menu = region('getCanvasMenuItems({', '}, contextMenu.x, contextMenu.y)');
        expect(menu).toContain('detachSelected: () => { if (isReadOnly) return; detachSelected(); }');
        expect(menu).toContain('deleteSelected: () => { if (isReadOnly) return; deleteSelected(); }');
    });

    it('guards the node context menu Delete, Detach and Duplicate actions', () => {
        const menu = region('getNodeMenuItems({', '}, hasSpecs');
        expect(menu).toContain('detachSelected: () => { if (isReadOnly) return; detachSelected(); }');
        expect(menu).toContain('detachFromFrame: () => { if (isReadOnly) return;');
        expect(menu).toContain('deleteSelected: () => { if (isReadOnly) return; deleteSelected(); }');
        expect(menu).toMatch(/duplicateAndGrab: \(\) => \{\s*if \(isReadOnly\) return;/);
    });

describe('hook-level read-only guards', () => {
    beforeEach(() => {
        nodes = [];
        mocks.applyTransaction.mockClear();
        mocks.push.mockClear();
    });

    it('useSelection refuses every mutating command', () => {
        nodes = [
            makeNode('a', 0, 0, { selected: true }),
            makeNode('b', 100, 0, { selected: true }),
        ];

        const { result } = renderHook(() => useSelection({ isReadOnly: true }));
        act(() => {
            result.current.deleteSelected();
            result.current.resetSelected();
            result.current.detachSelected();
            result.current.swapConnections();
            result.current.alignSelectedNodes('X');
        });

        expect(mocks.applyTransaction).not.toHaveBeenCalled();
        expect(mocks.push).not.toHaveBeenCalled();
    });
});

/* ------------------------------------------------------------------ */
/* Depth ordering                                                      */
/* ------------------------------------------------------------------ */
});

/* ------------------------------------------------------------------ */
/* Depth ordering                                                      */
/* ------------------------------------------------------------------ */

function coord(id: string, parentId?: string): CoordinateNode {
    return { id, position: { x: 0, y: 0 }, parentId };
}

describe('depth ordering', () => {
    it('sortParentFirst puts grandparent, parent, grandchild in depth order', () => {
        const sorted = sortParentFirst([
            coord('g', 'c'),
            coord('c', 'p'),
            coord('p'),
            coord('other'),
        ]);
        expect(sorted.map(n => n.id)).toEqual(['p', 'other', 'c', 'g']);
    });

    it('sortParentFirst keeps a broken (orphan) chain inside its local subtree', () => {
        const sorted = sortParentFirst([
            coord('g', 'c'),
            coord('c', 'missing'),
            coord('p'),
        ]);
        // The orphan chain is depth 0..1 locally, so it keeps declaration order
        // among roots while still placing `c` before `g`.
        expect(sorted.map(n => n.id)).toEqual(['c', 'p', 'g']);
    });
});

/* ------------------------------------------------------------------ */
/* deleteSelected: unwrap + parent-first undo payload                  */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({
    applyTransaction: vi.fn<(tx: any) => { success: boolean }>(() => ({ success: true })),
    push: vi.fn<(entry: any) => void>(),
}));

let nodes: Node[] = [];

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => ({
            getNodes: () => nodes,
            setNodes: vi.fn(),
            getEdges: () => [],
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
    useHistoryStore: (selector: (s: unknown) => unknown) => selector({ push: mocks.push }),
}));

import { useSelection } from '@/hooks/useSelection';

function makeNode(
    id: string,
    x: number,
    y: number,
    options: { parentId?: string; selected?: boolean; type?: string; width?: number; height?: number } = {}
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
        data: { label: 'IN-01', width: options.width ?? 100, height: options.height ?? 50 },
    } as unknown as Node;
}

describe('useSelection.deleteSelected frame ownership', () => {
    beforeEach(() => {
        nodes = [];
        mocks.applyTransaction.mockClear();
        mocks.push.mockClear();
    });

    it('applies exactly one BATCH (UI remove + Brain remove never double)', () => {
        nodes = [
            makeNode('f1', 100, 100, { type: 'frame', selected: true, width: 400, height: 300 }),
            makeNode('c1', 20, 30, { parentId: 'f1', selected: false }),
            makeNode('c2', 70, 30, { parentId: 'f1', selected: false }),
        ];

        const { result } = renderHook(() => useSelection());
        act(() => {
            result.current.deleteSelected();
        });

        expect(mocks.applyTransaction).toHaveBeenCalledTimes(1);
        const batch = mocks.applyTransaction.mock.calls[0][0] as {
            type: string;
            payload: Array<{ type: string; payload: any }>;
        };
        expect(batch.type).toBe('BATCH');

        // Children are unwrapped to world coordinates, not removed with the frame.
        const unwrapMoves = batch.payload.filter(tx => tx.type === 'MOVE_NODE');
        expect(unwrapMoves.map(tx => tx.payload)).toEqual([
            { id: 'c1', position: { x: 120, y: 130 }, parentId: null },
            { id: 'c2', position: { x: 170, y: 130 }, parentId: null },
        ]);
        const removes = batch.payload.filter(tx => tx.type === 'REMOVE_NODE');
        expect(removes.map(tx => tx.payload)).toEqual(['f1']);
    });

    it('undo payload re-adds a frame before its direct children', () => {
        // Deliberately declared child-first: the frame must still come first.
        nodes = [
            makeNode('c', 10, 10, { parentId: 'f1' }),
            makeNode('f1', 0, 0, { type: 'frame', width: 400, height: 300 }),
        ];

        const { result } = renderHook(() => useSelection());
        act(() => {
            result.current.deleteSelected();
        });

        const entry = mocks.push.mock.calls[0][0] as {
            inverse: Array<{ type: string; payload: any }>;
        };
        const added = entry.inverse.filter(tx => tx.type === 'ADD_NODE').map(tx => tx.payload.id);
        expect(added).toEqual(['f1', 'c']);

        // Every parent id appears earlier than the node that references it.
        const seen = new Set<string>();
        for (const id of added) {
            const node = nodes.find(n => n.id === id)!;
            if (node.parentId) expect(seen.has(node.parentId)).toBe(true);
            seen.add(id);
        }
    });

    /*
     * Depth ordering of history replay is enforced inside `computeNextState`
     * (sortParentFirst when any node has a parent). Covered below.
     */
    it('undo replay re-adds a grandchild after its parent regardless of stored indices', () => {
        const add = (id: string, parentId?: string) => ({
            type: 'ADD_NODE' as const,
            payload: { id, type: 'IN-01', position: { x: 0, y: 0 }, data: {}, parentId },
        });

        const { nextNodes } = computeNextState(
            [add('g', 'c'), add('c', 'p'), add('p')],
            [],
            [],
            // Deliberately inverted: child/grandchild indexed before the parent.
            { restoredNodeIndices: { g: 0, c: 1, p: 2 } }
        );

        expect(nextNodes.map(n => n.id)).toEqual(['p', 'c', 'g']);
    });

    it('removes children before their frame in the forward batch', () => {
        nodes = [
            makeNode('c1', 20, 30, { parentId: 'f1', selected: true }),
            makeNode('f1', 100, 100, { type: 'frame', selected: true, width: 400, height: 300 }),
        ];

        const { result } = renderHook(() => useSelection());
        act(() => {
            result.current.deleteSelected();
        });

        const batch = mocks.applyTransaction.mock.calls[0][0] as {
            payload: Array<{ type: string; payload: any }>;
        };
        const removed = batch.payload.filter(tx => tx.type === 'REMOVE_NODE').map(tx => tx.payload);
        expect(removed).toEqual(['c1', 'f1']);
    });

    it('Backspace resetSelected never emits a removal', () => {
        nodes = [
            makeNode('f1', 100, 100, { type: 'frame', selected: true, width: 400, height: 300 }),
            makeNode('c1', 20, 30, { parentId: 'f1', selected: true }),
        ];

        const { result } = renderHook(() => useSelection());
        act(() => {
            result.current.resetSelected();
        });

        expect(mocks.applyTransaction).toHaveBeenCalledTimes(1);
        const batch = mocks.applyTransaction.mock.calls[0][0] as {
            payload: Array<{ type: string; payload: any }>;
        };
        expect(batch.payload.every(tx => tx.type === 'UPDATE_NODE_DATA')).toBe(true);
        expect(batch.payload).toHaveLength(2);
    });
});
