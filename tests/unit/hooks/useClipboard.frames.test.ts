/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';
import {
    CLIPBOARD_SOURCE,
    ClipboardBuffer,
    computeClipboardLayout,
    expandSelectionWithDescendants,
    planPaste,
} from '@/utils/clipboardMath';

/**
 * P2 "下游整合" — clipboard with frames (docs/frame-integration.md §3-D8).
 *
 * Rules under test:
 * - Copy/cut/duplicate of a selected frame carries every descendant.
 * - Paste allocates new ids for the frame AND its children, rewrites the
 *   children's `parentId` to the new frame id, and keeps child positions
 *   parent-local (world placement matches the existing paste-offset rules).
 * - The buffer payload format is unchanged, so old clipboard JSON still works.
 */

const mocks = vi.hoisted(() => ({
    applyTransaction: vi.fn<(tx: any) => { success: boolean }>(() => ({ success: true })),
    push: vi.fn<(entry: any) => void>(),
}));

let nodes: Node[] = [];
let edges: Edge[] = [];

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => ({ getNodes: () => nodes, getEdges: () => edges }),
    };
});

vi.mock('@/context/BrainContext', () => ({
    useBrain: () => ({ applyTransaction: mocks.applyTransaction }),
}));

vi.mock('@/store/useHistoryStore', () => ({
    useHistoryStore: (selector: (s: unknown) => unknown) =>
        selector({ push: mocks.push }),
}));

import { useClipboard } from '@/hooks/useClipboard';

function makeNode(
    id: string,
    x: number,
    y: number,
    options: { parentId?: string; selected?: boolean; type?: string; width?: number; height?: number } = {}
): Node {
    return {
        id,
        type: options.type ?? 'IN-01',
        position: { x, y },
        parentId: options.parentId,
        selected: options.selected ?? false,
        width: options.width ?? 100,
        height: options.height ?? 50,
        measured: { width: options.width ?? 100, height: options.height ?? 50 },
        data: { label: id, width: options.width ?? 100, height: options.height ?? 50 },
    } as unknown as Node;
}

function frameGroup(selectedOnlyFrame = true): Node[] {
    return [
        makeNode('frame', 100, 100, {
            type: 'frame',
            width: 400,
            height: 300,
            selected: selectedOnlyFrame,
        }),
        makeNode('a', 20, 30, { parentId: 'frame' }),
        makeNode('b', 200, 30, { parentId: 'frame' }),
        makeNode('outside', 1000, 1000),
    ];
}

function addedNodesFromLastBatch(): Node[] {
    const calls = mocks.applyTransaction.mock.calls;
    const last = calls[calls.length - 1]?.[0];
    if (!last || last.type !== 'BATCH') return [];
    return (last.payload as any[])
        .filter(tx => tx.type === 'ADD_NODE')
        .map(tx => tx.payload as Node);
}

function lastBatch(): { type: string; payload: any[] } {
    const calls = mocks.applyTransaction.mock.calls;
    const last = calls[calls.length - 1]?.[0];
    return last ?? { type: '', payload: [] };
}

function absoluteOf(node: Node, all: Node[]): { x: number; y: number } {
    const byId = new Map(all.map(n => [n.id, n]));
    let x = node.position.x;
    let y = node.position.y;
    let parentId = node.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        const parent = byId.get(parentId);
        if (!parent) break;
        x += parent.position.x;
        y += parent.position.y;
        parentId = parent.parentId;
    }
    return { x, y };
}

describe('expandSelectionWithDescendants', () => {
    it('pulls in children of a selected frame, parent-first', () => {
        const all = frameGroup();

        const expanded = expandSelectionWithDescendants(all, new Set(['frame']));

        expect(expanded.map(n => n.id)).toEqual(['frame', 'a', 'b']);
    });

    it('keeps unselected descendants out when only the children are selected', () => {
        const all = frameGroup();

        const expanded = expandSelectionWithDescendants(all, new Set(['a']));

        expect(expanded.map(n => n.id)).toEqual(['a']);
    });

    it('returns flat selections unchanged and in graph order', () => {
        const all = [makeNode('x', 0, 0), makeNode('y', 100, 0)];

        expect(expandSelectionWithDescendants(all, new Set(['y', 'x'])).map(n => n.id))
            .toEqual(['x', 'y']);
    });
});

describe('planPaste with a frame group', () => {
    const bufferFor = (group: Node[]): ClipboardBuffer => ({
        intent: 'copy',
        nodes: group,
        edges: [],
        schemaVersion: '1.0.0',
        source: CLIPBOARD_SOURCE,
    });

    it('keeps child positions parent-local and shifts the frame to the paste target', () => {
        const group = frameGroup().filter(n => n.parentId || n.type === 'frame');
        const plan = planPaste({
            buffer: bufferFor(group),
            liveNodes: [],
            liveEdges: [],
            targetPos: { x: 600, y: 400 },
        })!;

        // Absolute bbox is 100..500 x 100..400 → center (300,250) → offset (300,150).
        expect(plan.offset).toEqual({ x: 300, y: 150 });

        const [frame, a, b] = plan.nodes;
        expect(frame.type).toBe('frame');
        expect(frame.position).toEqual({ x: 400, y: 250 });
        expect(a.position).toEqual({ x: 20, y: 30 });
        expect(b.position).toEqual({ x: 200, y: 30 });

        // Group moved rigidly: child absolute = pasted frame absolute + local.
        expect(absoluteOf(a, plan.nodes)).toEqual({ x: 420, y: 280 });
        expect(absoluteOf(b, plan.nodes)).toEqual({ x: 600, y: 280 });
    });

    it('allocates new ids for frame and children and rewrites parentId', () => {
        const group = frameGroup().filter(n => n.parentId || n.type === 'frame');
        const plan = planPaste({ buffer: bufferFor(group), liveNodes: [], liveEdges: [] })!;

        const [frame, a, b] = plan.nodes;
        expect(frame.id).not.toBe('frame');
        expect(a.id).not.toBe('a');
        expect(b.id).not.toBe('b');
        expect(a.parentId).toBe(frame.id);
        expect(b.parentId).toBe(frame.id);
        expect(frame.parentId).toBeUndefined();
    });

    it('emits ADD_NODE parent-first', () => {
        const group = frameGroup().filter(n => n.parentId || n.type === 'frame');
        const plan = planPaste({ buffer: bufferFor(group), liveNodes: [], liveEdges: [] })!;

        const addOrder = plan.forward
            .filter(tx => tx.type === 'ADD_NODE')
            .map(tx => (tx.payload as Node).id);

        expect(addOrder[0]).toBe(plan.nodes[0].id);
        expect(new Set(addOrder.slice(1))).toEqual(new Set([plan.nodes[1].id, plan.nodes[2].id]));
    });

    it('normalizes a legacy child-first buffer into parent-first paste order', () => {
        const group = frameGroup().filter(n => n.parentId || n.type === 'frame');
        const childFirst = [group[1], group[2], group[0]];

        const plan = planPaste({ buffer: bufferFor(childFirst), liveNodes: [], liveEdges: [] })!;

        expect(plan.nodes[0].type).toBe('frame');
        expect(plan.nodes.slice(1).every(n => n.parentId === plan.nodes[0].id)).toBe(true);
    });

    it('still accepts existing clipboard JSON (unchanged buffer format)', () => {
        const group = frameGroup().filter(n => n.parentId || n.type === 'frame');
        const buffer = bufferFor(group);
        // Old clipboard payloads were plain JSON: no fields added or renamed.
        const revived = JSON.parse(JSON.stringify(buffer)) as ClipboardBuffer;

        const plan = planPaste({ buffer: revived, liveNodes: [], liveEdges: [] })!;

        expect(plan.nodes).toHaveLength(3);
        expect(plan.nodes[0].type).toBe('frame');
        expect(plan.nodes[0].width).toBe(400);
        expect(plan.nodes[0].height).toBe(300);
        expect(plan.nodes[1].parentId).toBe(plan.nodes[0].id);
    });

    it('keeps flat paste behaviour identical (default {20,20} offset)', () => {
        const flat = [makeNode('n1', 0, 0), makeNode('n2', 200, 100)];
        const plan = planPaste({ buffer: bufferFor(flat), liveNodes: [], liveEdges: [] })!;

        expect(plan.offset).toEqual({ x: 20, y: 20 });
        expect(plan.nodes.map(n => n.position)).toEqual([
            { x: 20, y: 20 },
            { x: 220, y: 120 },
        ]);
        expect(plan.nodes.every(n => n.parentId === undefined)).toBe(true);
    });

    it('leaves the frame local layout untouched by computeClipboardLayout', () => {
        const group = frameGroup().filter(n => n.parentId || n.type === 'frame');
        const layout = computeClipboardLayout(group, []);

        expect(layout[0].absolute).toEqual({ x: 100, y: 100 });
        expect(layout[1].absolute).toEqual({ x: 120, y: 130 });
        expect(layout[1].position).toEqual({ x: 20, y: 30 });
    });
});

describe('useClipboard frame commands', () => {
    beforeEach(() => {
        nodes = [];
        edges = [];
        mocks.applyTransaction.mockClear();
        mocks.push.mockClear();
        mocks.applyTransaction.mockReturnValue({ success: true });
    });

    it('copy copies the frame with its descendants', () => {
        nodes = frameGroup();
        const { result } = renderHook(() => useClipboard());

        let copied = false;
        act(() => { copied = result.current.copyToClipboard(); });

        expect(copied).toBe(true);
        // Nothing hits the Brain on copy; the payload is in-memory only.
        expect(mocks.applyTransaction).not.toHaveBeenCalled();
    });

    it('paste after copy rebuilds the group with new ids and local child positions', () => {
        nodes = frameGroup();
        const { result } = renderHook(() => useClipboard());

        act(() => { result.current.copyToClipboard(); });
        // Simulate the canvas syncing nothing: paste next to the original group.
        act(() => { result.current.pasteFromClipboard({ x: 600, y: 400 }); });

        const added = addedNodesFromLastBatch();
        expect(added.map(n => n.type)).toEqual(['frame', 'IN-01', 'IN-01']);

        const [frame, a, b] = added;
        expect(frame.id).not.toBe('frame');
        expect(frame.position).toEqual({ x: 400, y: 250 });
        expect(frame.parentId).toBeUndefined();
        expect(frame.width).toBe(400);
        expect(frame.height).toBe(300);

        expect(a.parentId).toBe(frame.id);
        expect(b.parentId).toBe(frame.id);
        expect(a.position).toEqual({ x: 20, y: 30 });
        expect(b.position).toEqual({ x: 200, y: 30 });
    });

    it('duplicate of a selected frame duplicates its children too', () => {
        nodes = frameGroup();
        const { result } = renderHook(() => useClipboard());

        const out: { value: { nodes: Node[]; edges: Edge[] } | false } = { value: false };
        act(() => { out.value = result.current.duplicateSelected(); });

        expect(out.value).not.toBe(false);
        if (out.value === false) throw new Error('duplicateSelected returned false');
        const copy = out.value.nodes;
        expect(copy.map(n => n.type)).toEqual(['frame', 'IN-01', 'IN-01']);

        const [frame, a, b] = copy;
        expect(frame.id).not.toBe('frame');
        // DEC-2: duplicate offsets the root by {20,20}; children stay local.
        expect(frame.position).toEqual({ x: 120, y: 120 });
        expect(a.parentId).toBe(frame.id);
        expect(a.position).toEqual({ x: 20, y: 30 });
        expect(b.position).toEqual({ x: 200, y: 30 });
    });

    it('cut removes the frame and its descendants, children first', () => {
        nodes = frameGroup();
        const { result } = renderHook(() => useClipboard());

        let cut = false;
        act(() => { cut = result.current.cutSelected(); });

        expect(cut).toBe(true);
        const batch = lastBatch();
        const removed = (batch.payload as any[])
            .filter(tx => tx.type === 'REMOVE_NODE')
            .map(tx => tx.payload);

        expect(new Set(removed)).toEqual(new Set(['frame', 'a', 'b']));
        // Children go before their frame so no dangling parentId is left behind.
        expect(removed[removed.length - 1]).toBe('frame');
    });

    it('paste after cut restores the group with the original ids', () => {
        nodes = frameGroup();
        const { result } = renderHook(() => useClipboard());

        act(() => { result.current.cutSelected(); });

        // Brain removed the nodes; the canvas is now empty.
        nodes = [];

        act(() => { result.current.pasteFromClipboard(); });

        const added = addedNodesFromLastBatch();
        expect(added.map(n => n.id)).toEqual(['frame', 'a', 'b']);
        expect(added[0].position).toEqual({ x: 120, y: 120 });
        expect(added[1].parentId).toBe('frame');
        expect(added[1].position).toEqual({ x: 20, y: 30 });
    });

    it('flat copy/paste is unchanged', () => {
        nodes = [
            makeNode('n1', 0, 0, { selected: true }),
            makeNode('n2', 200, 100, { selected: true }),
        ];
        const { result } = renderHook(() => useClipboard());

        act(() => { result.current.copyToClipboard(); });
        act(() => { result.current.pasteFromClipboard(); });

        const added = addedNodesFromLastBatch();
        expect(added).toHaveLength(2);
        expect(added.map(n => n.position)).toEqual([{ x: 20, y: 20 }, { x: 220, y: 120 }]);
        expect(added.every(n => n.parentId === undefined)).toBe(true);
    });
});
