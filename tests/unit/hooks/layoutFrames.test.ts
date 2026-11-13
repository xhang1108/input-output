import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import {
    buildElkGraph,
    isFrameNode,
    mergeLayoutPositions,
    selectLayoutEdges,
    selectLayoutNodes,
} from '@/hooks/layoutEngine';

/**
 * P2 "下游整合" — layout policy (docs/frame-integration.md §3-D8 / §4-P2).
 *
 * Rule under test (option A):
 * - ELK only receives ROOT, NON-FRAME nodes.
 * - A frame is never moved, so its user-chosen placement survives re-layout.
 * - Children are never handed to ELK because their `position` is parent-local
 *   (`src/utils/coordinates.ts`); ELK writes world coordinates.
 * - Merging happens by id and only touches `position`.
 */

function makeNode(
    id: string,
    x: number,
    y: number,
    options: { parentId?: string; type?: string; width?: number; height?: number; extra?: Record<string, unknown> } = {}
): Node {
    return {
        id,
        type: options.type ?? 'IN-01',
        position: { x, y },
        parentId: options.parentId,
        width: options.width ?? 100,
        height: options.height ?? 50,
        data: { label: id },
        ...options.extra,
    } as unknown as Node;
}

function makeEdge(id: string, source: string, target: string): Edge {
    return { id, source, target } as Edge;
}

function frameGraph(): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [
        makeNode('frame', 1000, 500, {
            type: 'frame',
            width: 400,
            height: 300,
            extra: { style: { zIndex: 0 }, origin: [0, 0], measured: { width: 400, height: 300 } },
        }),
        makeNode('childA', 20, 30, { parentId: 'frame' }),
        makeNode('childB', 200, 30, { parentId: 'frame' }),
        makeNode('rootX', 0, 0),
        makeNode('rootY', 300, 0),
    ];

    const edges: Edge[] = [
        makeEdge('e-internal', 'childA', 'childB'),
        makeEdge('e-boundary', 'rootX', 'rootY'),
        makeEdge('e-frame', 'childB', 'rootX'),
    ];

    return { nodes, edges };
}

describe('layoutEngine frame policy', () => {
    it('detects frame nodes by type only', () => {
        expect(isFrameNode(makeNode('f', 0, 0, { type: 'frame' }))).toBe(true);
        expect(isFrameNode(makeNode('n', 0, 0))).toBe(false);
    });

    it('excludes the frame and every parented child from the layout pass', () => {
        const { nodes } = frameGraph();

        const layoutNodes = selectLayoutNodes(nodes);

        expect(layoutNodes.map(n => n.id)).toEqual(['rootX', 'rootY']);
    });

    it('restricts a partial (selection-scoped) pass and still drops frame children', () => {
        const { nodes } = frameGraph();

        const layoutNodes = selectLayoutNodes(nodes, {
            candidateIds: new Set(['childA', 'rootY']),
        });

        expect(layoutNodes.map(n => n.id)).toEqual(['rootY']);
    });

    it('drops edges that reference frames or frame children (ELK would reject them)', () => {
        const { nodes, edges } = frameGraph();
        const layoutNodes = selectLayoutNodes(nodes);

        const layoutEdges = selectLayoutEdges(edges, layoutNodes);

        expect(layoutEdges.map(e => e.id)).toEqual(['e-boundary']);
    });

    it('builds an ELK graph without frame nodes or frame-internal edges', () => {
        const { nodes, edges } = frameGraph();

        const { graph, layoutNodes } = buildElkGraph(nodes, edges, { algorithm: 'layered' });

        expect(graph.children.map((c: { id: string }) => c.id)).toEqual(['rootX', 'rootY']);
        expect(graph.edges.map((e: { id: string }) => e.id)).toEqual(['e-boundary']);
        expect(layoutNodes.map(n => n.id)).toEqual(['rootX', 'rootY']);
    });

    it('keeps a flat graph input identical (all roots and all edges)', () => {
        const nodes = [makeNode('a', 0, 0), makeNode('b', 200, 0)];
        const edges = [makeEdge('e1', 'a', 'b')];

        const { graph } = buildElkGraph(nodes, edges);

        expect(graph.children.map((c: { id: string }) => c.id)).toEqual(['a', 'b']);
        expect(graph.edges.map((e: { id: string }) => e.id)).toEqual(['e1']);
    });
});

describe('mergeLayoutPositions', () => {
    it('merges by id: only positions change, frames keep parentId/size/style', () => {
        const { nodes } = frameGraph();
        const layouted = [
            { ...nodes[3], position: { x: 50, y: 60 } },   // rootX moved
            { ...nodes[4], position: { x: 350, y: 60 } },  // rootY moved
        ];

        const merged = mergeLayoutPositions(nodes, layouted);

        // Nothing dropped, original order preserved.
        expect(merged.map(n => n.id)).toEqual(nodes.map(n => n.id));

        const frame = merged.find(n => n.id === 'frame')!;
        expect(frame.position).toEqual({ x: 1000, y: 500 });
        expect(frame.width).toBe(400);
        expect(frame.height).toBe(300);
        expect((frame.style as Record<string, unknown>).zIndex).toBe(0);

        // Children keep their local positions and their parent link.
        const childA = merged.find(n => n.id === 'childA')!;
        expect(childA.position).toEqual({ x: 20, y: 30 });
        expect(childA.parentId).toBe('frame');

        // Laid-out roots take the ELK positions.
        expect(merged.find(n => n.id === 'rootX')!.position).toEqual({ x: 50, y: 60 });
        expect(merged.find(n => n.id === 'rootY')!.position).toEqual({ x: 350, y: 60 });
    });

    it('never moves a frame even if a layout result contains one', () => {
        const { nodes } = frameGraph();
        const strayFrame = { ...nodes[0], position: { x: 0, y: 0 } };

        const merged = mergeLayoutPositions(nodes, [strayFrame]);

        expect(merged.find(n => n.id === 'frame')!.position).toEqual({ x: 1000, y: 500 });
    });

    it('ignores layout results for unknown ids (no nodes invented or dropped)', () => {
        const { nodes } = frameGraph();
        const ghost = { ...makeNode('ghost', 0, 0), position: { x: 1, y: 2 } };

        const merged = mergeLayoutPositions(nodes, [ghost]);

        expect(merged).toHaveLength(nodes.length);
        expect(merged.some(n => n.id === 'ghost')).toBe(false);
    });

    it('is a no-op for a flat graph whose positions did not change', () => {
        const nodes = [makeNode('a', 0, 0), makeNode('b', 200, 0)];

        const merged = mergeLayoutPositions(nodes, nodes.map(n => ({ ...n })));

        expect(merged).toEqual(nodes);
    });
});
