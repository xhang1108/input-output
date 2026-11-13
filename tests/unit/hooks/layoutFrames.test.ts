import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import {
    buildElkGraph,
    isFrameNode,
    mergeLayoutPositions,
    planPartialLayout,
    selectLayoutEdges,
    selectLayoutNodes,
} from '@/hooks/layoutEngine';

/**
 * P2 "下游整合" — layout policy (docs/frame-integration.md §3-D8 / §4-P2).
 *
 * Rules under test:
 * - World pass: roots only, frames included as one sized block (the group
 *   moves together; children keep parent-local positions).
 * - Inside-frame pass: selected children are laid out in their frame's local
 *   space, and the frame grows to fit them.
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

    it('includes frames as world blocks and excludes their children', () => {
        const { nodes } = frameGraph();

        const layoutNodes = selectLayoutNodes(nodes);

        expect(layoutNodes.map(n => n.id)).toEqual(['frame', 'rootX', 'rootY']);
    });

    it('restricts a partial (selection-scoped) pass to the selected roots', () => {
        const { nodes } = frameGraph();

        const layoutNodes = selectLayoutNodes(nodes, {
            candidateIds: new Set(['childA', 'rootY', 'frame']),
        });

        expect(layoutNodes.map(n => n.id)).toEqual(['frame', 'rootY']);
    });

    it('drops edges that reference frame children (ELK would reject them)', () => {
        const { nodes, edges } = frameGraph();
        const layoutNodes = selectLayoutNodes(nodes);

        const layoutEdges = selectLayoutEdges(edges, layoutNodes);

        expect(layoutEdges.map(e => e.id)).toEqual(['e-boundary']);
    });

    it('builds an ELK graph from the given participants', () => {
        const { nodes, edges } = frameGraph();
        const participants = selectLayoutNodes(nodes);

        const { graph, layoutNodes } = buildElkGraph(participants, edges, { algorithm: 'layered' });

        expect(graph.children.map((c: { id: string }) => c.id)).toEqual(['frame', 'rootX', 'rootY']);
        expect(graph.edges.map((e: { id: string }) => e.id)).toEqual(['e-boundary']);
        expect(layoutNodes.map(n => n.id)).toEqual(['frame', 'rootX', 'rootY']);
    });

    it('sizes a frame block from its width/height when it has no measured size', () => {
        const nodes = [makeNode('frame', 100, 100, { type: 'frame', width: 400, height: 300 })];
        const { graph } = buildElkGraph(nodes, []);

        expect(graph.children[0]).toMatchObject({ id: 'frame', width: 400, height: 300 });
    });

    it('keeps a flat graph input identical (all roots and all edges)', () => {
        const nodes = [makeNode('a', 0, 0), makeNode('b', 200, 0)];
        const edges = [makeEdge('e1', 'a', 'b')];

        const { graph } = buildElkGraph(nodes, edges);

        expect(graph.children.map((c: { id: string }) => c.id)).toEqual(['a', 'b']);
        expect(graph.edges.map((e: { id: string }) => e.id)).toEqual(['e1']);
    });
});

describe('planPartialLayout', () => {
    it('lays out the contents of a selected frame and keeps the frame in place', () => {
        const { nodes } = frameGraph();

        const plan = planPartialLayout(nodes, new Set(['frame']));

        expect(plan.worldNodes).toEqual([]);
        expect(plan.childGroups).toHaveLength(1);
        expect(plan.childGroups[0].frameId).toBe('frame');
        expect(plan.childGroups[0].nodes.map(n => n.id).sort()).toEqual(['childA', 'childB']);
    });

    it('does not duplicate children when the frame and a child are both selected', () => {
        const { nodes } = frameGraph();

        const plan = planPartialLayout(nodes, new Set(['frame', 'childA']));

        expect(plan.childGroups[0].nodes.map(n => n.id).sort()).toEqual(['childA', 'childB']);
    });

    it('lays out selected children inside their frame', () => {
        const { nodes } = frameGraph();

        const plan = planPartialLayout(nodes, new Set(['childA']));

        expect(plan.worldNodes).toEqual([]);
        expect(plan.childGroups).toHaveLength(1);
        expect(plan.childGroups[0].frameId).toBe('frame');
        expect(plan.childGroups[0].nodes.map(n => n.id)).toEqual(['childA']);
    });

    it('splits a mixed selection into world roots and per-frame child groups', () => {
        const { nodes } = frameGraph();
        nodes.push(makeNode('frame2', 0, 800, { type: 'frame', width: 300, height: 200 }));
        nodes.push(makeNode('childC', 20, 20, { parentId: 'frame2' }));

        const plan = planPartialLayout(nodes, new Set(['rootX', 'childA', 'childC']));

        expect(plan.worldNodes.map(n => n.id)).toEqual(['rootX']);
        expect(plan.childGroups.map(g => g.frameId).sort()).toEqual(['frame', 'frame2']);
    });

    it('keeps a selected frame fixed while other selected roots are laid out', () => {
        const { nodes } = frameGraph();

        const plan = planPartialLayout(nodes, new Set(['frame', 'rootX']));

        expect(plan.worldNodes.map(n => n.id)).toEqual(['rootX']);
        expect(plan.childGroups.map(g => g.frameId)).toEqual(['frame']);
    });

    it('ignores selected nodes whose parent no longer exists', () => {
        const { nodes } = frameGraph();

        const plan = planPartialLayout(nodes, new Set(['ghost', 'orphan']));

        expect(plan).toEqual({ worldNodes: [], childGroups: [] });
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

    it('moves a frame block but keeps its size, style and children parented', () => {
        const { nodes } = frameGraph();
        const strayFrame = { ...nodes[0], position: { x: 0, y: 0 } };

        const merged = mergeLayoutPositions(nodes, [strayFrame]);

        const frame = merged.find(n => n.id === 'frame')!;
        expect(frame.position).toEqual({ x: 0, y: 0 });
        expect(frame.width).toBe(400);
        expect(frame.height).toBe(300);
        expect((frame.style as Record<string, unknown>).zIndex).toBe(0);
        expect(merged.find(n => n.id === 'childA')!.parentId).toBe('frame');
        expect(merged.find(n => n.id === 'childA')!.position).toEqual({ x: 20, y: 30 });
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
