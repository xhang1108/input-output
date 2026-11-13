import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import {
    buildClipboardNodes,
    buildInsertTransactions,
    CLIPBOARD_SOURCE,
    computeClipboardLayout,
    computePasteOffset,
    ClipboardBuffer,
    ClipboardIntent,
    getNodeAbsolutePosition,
    planPaste,
} from '@/utils/clipboardMath';

function makeNode(id: string, x: number, y: number, extra: Record<string, unknown> = {}): Node {
    return {
        id,
        type: 'IN-01',
        position: { x, y },
        data: { label: id },
        width: 100,
        height: 50,
        ...extra,
    } as unknown as Node;
}

function makeEdge(id: string, source: string, target: string): Edge {
    return { id, source, target } as Edge;
}

function makeBuffer(intent: ClipboardIntent, nodes: Node[], edges: Edge[] = []): ClipboardBuffer {
    return { intent, nodes, edges, schemaVersion: '1.0.0', source: CLIPBOARD_SOURCE };
}

function bboxCenter(nodes: Node[]): { x: number; y: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
        const w = n.measured?.width ?? n.width ?? 0;
        const h = n.measured?.height ?? n.height ?? 0;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
    });
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

describe('clipboardMath', () => {
    describe('frame coordinate truth', () => {
        it('treats parent position as top-left: child absolute = parent.position + child.position', () => {
            // Evidence: FlowCanvas.tsx:61/731 nodeOrigin [0,0] and React Flow's
            // calculateChildXYZ (no half-size shift). Brain's -parentW/2 is stale.
            const parent = makeNode('frame', 1000, 500, { data: { label: 'frame', width: 400, height: 300 } });
            const child = makeNode('child', 30, 40, { parentId: 'frame' });
            const map = new Map<string, Node>([[parent.id, parent], [child.id, child]]);

            expect(getNodeAbsolutePosition('child', map)).toEqual({ x: 1030, y: 540 });
        });
    });

    describe('DEC-3 id policy', () => {
        it('copy → paste always generates new node and edge ids', () => {
            const n1 = makeNode('n1', 0, 0);
            const n2 = makeNode('n2', 200, 0);
            const e1 = makeEdge('e1', 'n1', 'n2');
            const buffer = makeBuffer('copy', [n1, n2], [e1]);

            const plan = planPaste({ buffer, liveNodes: [], liveEdges: [] });

            expect(plan).not.toBeNull();
            expect(plan!.reusedIds).toBe(false);
            expect(plan!.nodes.map(n => n.id)).not.toContain('n1');
            expect(plan!.nodes.map(n => n.id)).not.toContain('n2');
            expect(plan!.edges).toHaveLength(1);
            expect(plan!.edges[0].id).not.toBe('e1');
            expect(plan!.edges[0].source).toBe(plan!.nodes[0].id);
            expect(plan!.edges[0].target).toBe(plan!.nodes[1].id);
        });

        it('cut → paste reuses original ids when they are free in the live graph', () => {
            const n1 = makeNode('n1', 0, 0);
            const n2 = makeNode('n2', 200, 0);
            const e1 = makeEdge('e1', 'n1', 'n2');
            const buffer = makeBuffer('cut', [n1, n2], [e1]);

            // The cut already removed them; only an unrelated node is present.
            const plan = planPaste({ buffer, liveNodes: [makeNode('other', 500, 500)], liveEdges: [] });

            expect(plan).not.toBeNull();
            expect(plan!.reusedIds).toBe(true);
            expect(plan!.nodes.map(n => n.id)).toEqual(['n1', 'n2']);
            expect(plan!.edges[0].id).toBe('e1');
            expect(plan!.edges[0].source).toBe('n1');
            expect(plan!.edges[0].target).toBe('n2');
        });

        it('cut → paste falls back to new ids when any id is occupied', () => {
            const n1 = makeNode('n1', 0, 0);
            const e1 = makeEdge('e1', 'n1', 'n1');
            const buffer = makeBuffer('cut', [n1], [e1]);

            // e.g. the user undid the cut, so the original node exists again.
            const plan = planPaste({ buffer, liveNodes: [makeNode('n1', 0, 0)], liveEdges: [] });

            expect(plan).not.toBeNull();
            expect(plan!.reusedIds).toBe(false);
            expect(plan!.nodes[0].id).not.toBe('n1');
            expect(plan!.edges[0].id).not.toBe('e1');
            expect(plan!.edges[0].source).toBe(plan!.nodes[0].id);
        });
    });

    describe('DEC-1 paste alignment', () => {
        it('places the absolute bbox center exactly on targetPos', () => {
            const buffer = makeBuffer('copy', [makeNode('n1', 0, 0), makeNode('n2', 200, 100)]);
            const targetPos = { x: 500, y: 400 };

            const plan = planPaste({ buffer, liveNodes: [], liveEdges: [], targetPos });

            expect(plan).not.toBeNull();
            expect(bboxCenter(plan!.nodes)).toEqual(targetPos);
            expect(plan!.offset).toEqual({ x: 350, y: 325 });
        });

        it('centers using absolute coordinates when a child sits inside a buffered frame', () => {
            const frame = makeNode('frame', 0, 0, { width: 400, height: 300, data: { label: 'frame', width: 400, height: 300 } });
            const child = makeNode('child', 50, 60, { parentId: 'frame', width: 100, height: 50 });
            const buffer = makeBuffer('copy', [frame, child]);
            const targetPos = { x: 0, y: 0 };

            const plan = planPaste({ buffer, liveNodes: [], liveEdges: [], targetPos });
            const layout = computeClipboardLayout(buffer.nodes, []);

            // Absolute bbox: x 0..400, y 0..300 → center (200,150).
            expect(computePasteOffset(layout, targetPos)).toEqual({ x: -200, y: -150 });
            expect(plan!.nodes[0].position).toEqual({ x: -200, y: -150 });
            // Child keeps its relative position (no double offset).
            expect(plan!.nodes[1].position).toEqual({ x: 50, y: 60 });
            expect(plan!.nodes[1].parentId).toBe(plan!.nodes[0].id);
        });

        it('falls back to top-left alignment on axes with unknown size', () => {
            const noSize = { id: 'n1', type: 'IN-01', position: { x: 10, y: 20 }, data: {} } as unknown as Node;
            const layout = computeClipboardLayout([noSize], []);

            expect(computePasteOffset(layout, { x: 100, y: 200 })).toEqual({ x: 90, y: 180 });
        });
    });

    describe('DEC-6 B detached children', () => {
        it('clears parentId and converts to absolute when the parent is not in the clipboard', () => {
            const liveParent = makeNode('frame', 1000, 500, {
                data: { label: 'frame', width: 400, height: 300 },
            });
            const child = makeNode('child', 30, 40, { parentId: 'frame' });
            const buffer = makeBuffer('copy', [child]);

            const plan = planPaste({ buffer, liveNodes: [liveParent], liveEdges: [] });
            const layout = computeClipboardLayout(buffer.nodes, [liveParent]);

            expect(layout[0].detached).toBe(true);
            expect(layout[0].absolute).toEqual({ x: 1030, y: 540 });
            expect(layout[0].position).toEqual({ x: 1030, y: 540 });
            // Absolute position + default {20,20} paste offset.
            expect(plan!.nodes[0].parentId).toBeUndefined();
            expect(plan!.nodes[0].position).toEqual({ x: 1050, y: 560 });
        });
    });

    describe('empty clipboard', () => {
        it('returns null and builds no nodes for a missing or empty buffer', () => {
            expect(planPaste({ buffer: null, liveNodes: [], liveEdges: [] })).toBeNull();
            expect(planPaste({ buffer: makeBuffer('copy', []), liveNodes: [], liveEdges: [] })).toBeNull();
            expect(buildClipboardNodes([], new Map(), { x: 20, y: 20 })).toEqual([]);
        });
    });

    describe('transaction assembly', () => {
        it('ADD_NODE transactions always carry initialValue from data.value', () => {
            const node = makeNode('n1', 0, 0, { data: { label: 'n1', value: 42 } });
            const txs = buildInsertTransactions([node], [makeEdge('e1', 'n1', 'n1')]);

            expect(txs[0]).toMatchObject({
                type: 'ADD_NODE',
                payload: { id: 'n1', initialValue: 42 },
            });
            expect(txs[1]).toMatchObject({ type: 'CONNECT', payload: { id: 'e1' } });
        });
    });
});
