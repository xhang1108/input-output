import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { Brain } from '@/engine/Brain';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { hydrateGroupNodeHandles, hydrateGroupPorts } from '@/utils/groupPorts';
import {
    buildCommitTransactions,
    buildGroupTransactions,
    buildUngroupTransactions,
    deriveBoundaryFromPortalEdges,
    type LiteEdge,
    type LiteNode,
} from '@/hooks/useGroupActions';
import type { GroupNodeData } from '@/types/groupNode';

// P3 UI acceptance (GROUP_NODE_PLAN §8.1 / §8.6 / §8.7):
// boundary↔handles 1:1, reload rebuild, and one Ctrl+Z restoring each of
// group / ungroup / internal edit.

beforeAll(() => {
    NodeRegistry.initializeNodes();
});

const N = (id: string, type: string, x: number, data: Record<string, unknown> = {}): LiteNode => ({
    id,
    type,
    position: { x, y: 0 },
    data,
});
const E = (
    id: string,
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string
): { id: string; source: string; sourceHandle: string; target: string; targetHandle: string; type: string; data: Record<string, unknown> } => ({
    id,
    source,
    sourceHandle,
    target,
    targetHandle,
    type: 'magnetic',
    data: { pathType: 'bezier' },
});

// a(IN-01) → b(MA-01/ADD) → c(MA-02) → d(OT-01); group {b, c}.
const canvas = () => ({
    nodes: [
        N('a', 'IN-01', -200, { value: 2 }),
        N('b', 'MA-01', 0, { mode: 'ADD' }),
        N('c', 'MA-02', 200, { mode: 'POW' }),
        N('d', 'OT-01', 400, {}),
    ],
    edges: [
        E('e1', 'a', 'out_a', 'b', 'in_a'),
        E('e2', 'b', 'out_a', 'c', 'in_a'),
        E('e3', 'c', 'out_a', 'd', 'in_a'),
    ],
});

const brainSnapshot = (brain: Brain) => ({
    nodes: [...brain.getNodesMap().values()].map((n) => ({
        id: n.id,
        type: n.type,
        position: { ...n.position },
        data: JSON.parse(JSON.stringify(n.data ?? {})),
    })),
    edges: brain.getEdges().map((e) => ({ ...e })),
});

describe('P3 group topology (group/ungroup)', () => {
    it('derives boundary↔handles 1:1 with stable external-edge portIds', () => {
        const { nodes, edges } = canvas();
        const built = buildGroupTransactions({ nodes, edges, selectedIds: ['b', 'c'], groupId: 'g1' });
        expect('error' in built).toBe(false);
        if ('error' in built) return;
        const boundary = built.group.data.boundary;
        expect(boundary.inputs.map((p) => p.portId)).toEqual(['in_a__out_a']);
        expect(boundary.outputs.map((p) => p.portId)).toEqual(['out_d__in_a']);
        expect(boundary.inputs[0]).toMatchObject({ innerNodeId: 'b', innerHandle: 'in_a' });
        expect(boundary.outputs[0]).toMatchObject({ innerNodeId: 'c', innerHandle: 'out_a' });

        // §8.1: every boundary port has exactly one shell handle and vice versa.
        const handles = hydrateGroupPorts(boundary);
        expect(handles.map((h) => h.id).sort()).toEqual(
            [...boundary.inputs, ...boundary.outputs].map((p) => p.portId).sort()
        );
        expect(handles.find((h) => h.id === 'in_a__out_a')?.type).toBe('target');
        expect(handles.find((h) => h.id === 'out_d__in_a')?.type).toBe('source');

        // Same graph regrouped → same portIds (undo/reload stable).
        const again = buildGroupTransactions({ nodes, edges, selectedIds: ['b', 'c'], groupId: 'g2' });
        expect('error' in again).toBe(false);
        if ('error' in again) return;
        expect(again.group.data.boundary).toEqual(boundary);
    });

    it('rejects frame/group in the selection (D2)', () => {
        const { nodes, edges } = canvas();
        const withFrame = [...nodes, N('f', 'frame', 0, {})];
        const built = buildGroupTransactions({ nodes: withFrame, edges, selectedIds: ['b', 'f'], groupId: 'g1' });
        expect('error' in built).toBe(true);
    });

    it('dedupes fan-out with a stable suffix (1:1 preserved)', () => {
        const nodes = [N('a', 'IN-01', -200, { value: 1 }), N('b', 'MA-01', 0, {}), N('c', 'MA-01', 100, {})];
        const edges = [E('e1', 'a', 'out_a', 'b', 'in_a'), E('e2', 'a', 'out_a', 'c', 'in_a')];
        const built = buildGroupTransactions({ nodes, edges, selectedIds: ['b', 'c'], groupId: 'g1' });
        expect('error' in built).toBe(false);
        if ('error' in built) return;
        const ids = built.group.data.boundary.inputs.map((p) => p.portId);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain('in_a__out_a');
        expect(hydrateGroupPorts(built.group.data.boundary).map((h) => h.id).sort()).toEqual([...ids].sort());
    });

    it('upgrades an internal Slider to an input port (D10)', () => {
        const nodes = [
            N('s', 'IN-02', -100, { value: 7, min: 0, max: 10, step: 1 }),
            N('b', 'MA-01', 0, { mode: 'ADD' }),
            N('d', 'OT-01', 200, {}),
        ];
        const edges = [E('e1', 's', 'out_a', 'b', 'in_b'), E('e2', 'b', 'out_a', 'd', 'in_a')];
        const built = buildGroupTransactions({ nodes, edges, selectedIds: ['s', 'b'], groupId: 'g1' });
        expect('error' in built).toBe(false);
        if ('error' in built) return;
        // Slider leaves the subGraph; its value rides the port default.
        expect(built.group.data.subGraph.nodes.map((n) => n.id)).toEqual(['b']);
        const sliderPort = built.group.data.boundary.inputs.find((p) => p.portId.startsWith('in_slider_'));
        expect(sliderPort).toMatchObject({ defaultValue: 7, innerNodeId: 'b', innerHandle: 'in_b' });
        expect(sliderPort?.constraints).toEqual({ min: 0, max: 10, step: 1 });
    });

    it('keeps an externally-wired Slider inside the subGraph (no edge loss)', () => {
        const nodes = [
            N('s', 'IN-02', -100, { value: 7, min: 0, max: 10, step: 1 }),
            N('b', 'MA-01', 0, { mode: 'ADD' }),
            N('d', 'OT-01', 200, {}),
        ];
        const edges = [
            E('e1', 's', 'out_a', 'b', 'in_b'),
            E('e2', 's', 'out_a', 'd', 'in_a'),
            E('e3', 'b', 'out_a', 'd', 'in_a'),
        ];
        const built = buildGroupTransactions({ nodes, edges, selectedIds: ['s', 'b'], groupId: 'g1' });
        expect('error' in built).toBe(false);
        if ('error' in built) return;
        expect(built.group.data.subGraph.nodes.map((n) => n.id).sort()).toEqual(['b', 's']);
        expect(built.group.data.boundary.inputs.some((p) => p.portId.startsWith('in_slider_'))).toBe(false);
    });

    it('removes a frame emptied by grouping (no gray box left behind)', () => {
        const { edges } = canvas();
        const framed = [
            N('a', 'IN-01', -200, { value: 2 }),
            { ...N('b', 'MA-01', 0, { mode: 'ADD' }), parentId: 'f' },
            { ...N('c', 'MA-02', 200, { mode: 'POW' }), parentId: 'f' },
            N('d', 'OT-01', 400, {}),
            { ...N('f', 'frame', -100, {}), width: 500, height: 300 },
        ];
        const built = buildGroupTransactions({ nodes: framed, edges, selectedIds: ['b', 'c'], groupId: 'g1' });
        expect('error' in built).toBe(false);
        if ('error' in built) return;
        // Forward drops the emptied frame alongside the grouped nodes.
        expect(built.forward.filter((t) => t.type === 'REMOVE_NODE').map((t) => t.payload)).toContain('f');
        // Inverse re-adds the frame parent-first (before the node ADDs).
        const adds = built.inverse.filter((t) => t.type === 'ADD_NODE');
        const frameIdx = adds.findIndex((t) => (t.payload as { id: string }).id === 'f');
        const firstNodeIdx = adds.findIndex((t) => (t.payload as { id: string }).id === 'b');
        expect(frameIdx).toBeGreaterThanOrEqual(0);
        expect(frameIdx).toBeLessThan(firstNodeIdx);
        expect((adds[frameIdx].payload as { type: string }).type).toBe('frame');
    });

    it('removes a stray empty frame overlapping the selection', () => {
        const { edges } = canvas();
        const withStrays = [
            ...canvas().nodes,
            { ...N('stray', 'frame', -50, {}), width: 300, height: 200 },
            { ...N('far', 'frame', 5000, {}), width: 300, height: 200 },
        ];
        const built = buildGroupTransactions({ nodes: withStrays, edges, selectedIds: ['b', 'c'], groupId: 'g1' });
        expect('error' in built).toBe(false);
        if ('error' in built) return;
        const removed = built.forward.filter((t) => t.type === 'REMOVE_NODE').map((t) => t.payload);
        expect(removed).toContain('stray');
        expect(removed).not.toContain('far');
        // Undo brings the stray back.
        const adds = built.inverse.filter((t) => t.type === 'ADD_NODE');
        expect(adds.some((t) => (t.payload as { id: string }).id === 'stray')).toBe(true);
    });

    it('keeps a partially-emptied frame', () => {
        const { edges } = canvas();
        const framed = [
            N('a', 'IN-01', -200, { value: 2 }),
            { ...N('b', 'MA-01', 0, { mode: 'ADD' }), parentId: 'f' },
            { ...N('c', 'MA-02', 200, { mode: 'POW' }), parentId: 'f' },
            { ...N('d', 'OT-01', 400, {}), parentId: 'f' },
            N('f', 'frame', -100, {}),
        ];
        // Group only b: d stays inside f, so the frame must survive.
        const built = buildGroupTransactions({ nodes: framed, edges, selectedIds: ['b'], groupId: 'g1' });
        expect('error' in built).toBe(false);
        if ('error' in built) return;
        expect(built.forward.filter((t) => t.type === 'REMOVE_NODE').map((t) => t.payload)).not.toContain('f');
    });
});

describe('P3 undo: one Ctrl+Z restores group / ungroup / internal edit', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    afterEach(() => {
        brain.dispose();
    });

    async function seedMain() {
        const { nodes, edges } = canvas();
        await brain.injectNodes(
            {
                nodes: nodes.map((n) => ({ id: n.id, type: n.type!, position: n.position, data: n.data ?? {} })),
                edges: edges.map((e) => ({ ...e })),
            },
            true
        );
    }

    it('group forward then inverse restores nodes and edge ids', async () => {
        await seedMain();
        const before = brainSnapshot(brain);
        const { nodes, edges } = canvas();
        const built = buildGroupTransactions({ nodes, edges, selectedIds: ['b', 'c'], groupId: 'g1' });
        expect('error' in built).toBe(false);
        if ('error' in built) return;

        expect(brain.applyTransaction({ type: 'BATCH', payload: built.forward }).success).toBe(true);
        expect(brain.getNode('g1')?.type).toBe('group');
        expect(brain.getNode('b')).toBeUndefined();
        // Reload path: handles rebuild from boundary (§8.1).
        const stored = brain.getNode('g1')!;
        const rehydrated = hydrateGroupNodeHandles({ ...(stored.data as object), handles: undefined } as Record<string, unknown>);
        expect(rehydrated?.map((h) => h.id).sort()).toEqual(['in_a__out_a', 'out_d__in_a']);

        expect(brain.applyTransaction({ type: 'BATCH', payload: built.inverse }).success).toBe(true);
        const after = brainSnapshot(brain);
        expect(after.nodes.map((n) => n.id).sort()).toEqual(before.nodes.map((n) => n.id).sort());
        expect(after.edges.map((e) => e.id).sort()).toEqual(before.edges.map((e) => e.id).sort());
        expect(after.edges).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'e1', target: 'b' })]));
    });

    it('Brain apply: emptied frame gone, inverse brings it back with children', async () => {
        const { edges } = canvas();
        const framed = [
            { ...N('a', 'IN-01', -200, { value: 2 }) },
            { ...N('b', 'MA-01', 0, { mode: 'ADD' }), parentId: 'f' },
            { ...N('c', 'MA-02', 200, { mode: 'POW' }), parentId: 'f' },
            { ...N('d', 'OT-01', 400, {}) },
            { ...N('f', 'frame', -100, {}), width: 500, height: 300 },
        ];
        await brain.injectNodes(
            {
                nodes: framed.map((n) => ({
                    id: n.id, type: n.type!, position: n.position, data: n.data ?? {},
                    parentId: (n as LiteNode).parentId ?? undefined,
                    width: (n as LiteNode).width, height: (n as LiteNode).height,
                })),
                edges: edges.map((e) => ({ ...e })),
            },
            true
        );
        const built = buildGroupTransactions({
            nodes: framed as LiteNode[], edges: edges as LiteEdge[], selectedIds: ['b', 'c'], groupId: 'g1',
        });
        expect('error' in built).toBe(false);
        if ('error' in built) return;
        expect(brain.applyTransaction({ type: 'BATCH', payload: built.forward }).success).toBe(true);
        expect(brain.getNode('f')).toBeUndefined();
        expect(brain.getNode('g1')?.parentId).toBeUndefined();
        expect(brain.applyTransaction({ type: 'BATCH', payload: built.inverse }).success).toBe(true);
        expect(brain.getNode('f')?.type).toBe('frame');
        expect(brain.getNode('b')?.parentId).toBe('f');
        expect(brain.getNode('c')?.parentId).toBe('f');
    });

    it('ungroup then inverse restores the group with its boundary edges', async () => {
        await seedMain();
        const { nodes, edges } = canvas();
        const grouped = buildGroupTransactions({ nodes, edges, selectedIds: ['b', 'c'], groupId: 'g1' });
        expect('error' in grouped).toBe(false);
        if ('error' in grouped) return;
        expect(brain.applyTransaction({ type: 'BATCH', payload: grouped.forward }).success).toBe(true);

        const mainEdges = brain.getEdges() as LiteEdge[];
        const ungrouped = buildUngroupTransactions({
            groupId: 'g1',
            groupPosition: { x: 0, y: 0 },
            groupData: cloneData(grouped.group.data),
            mainEdges,
        });
        expect(brain.applyTransaction({ type: 'BATCH', payload: ungrouped.forward }).success).toBe(true);
        expect(brain.getNode('g1')).toBeUndefined();
        expect(brain.getNode('b')).toBeDefined();
        expect(brain.getNode('c')).toBeDefined();

        expect(brain.applyTransaction({ type: 'BATCH', payload: ungrouped.inverse }).success).toBe(true);
        expect(brain.getNode('g1')?.type).toBe('group');
        const restored = brain.getNode('g1')!;
        expect((restored.data as unknown as GroupNodeData).boundary.inputs.map((p) => p.portId)).toEqual(['in_a__out_a']);
    });

    it('internal-edit commit then inverse restores the previous snapshot', async () => {
        await seedMain();
        const { nodes, edges } = canvas();
        const grouped = buildGroupTransactions({ nodes, edges, selectedIds: ['b', 'c'], groupId: 'g1' });
        expect('error' in grouped).toBe(false);
        if ('error' in grouped) return;
        expect(brain.applyTransaction({ type: 'BATCH', payload: grouped.forward }).success).toBe(true);
        const original = cloneData({
            subGraph: grouped.group.data.subGraph,
            boundary: grouped.group.data.boundary,
        });

        // Simulate a scope edit: move b and re-point the input port at c/in_b.
        const next = cloneData(original);
        next.subGraph.nodes.find((n) => n.id === 'b')!.position = { x: 50, y: 10 };
        next.boundary.inputs = [{ ...next.boundary.inputs[0], innerNodeId: 'c', innerHandle: 'in_b' }];
        const commit = buildCommitTransactions({
            groupId: 'g1',
            original,
            next,
            mainEdges: brain.getEdges() as LiteEdge[],
        });
        expect(commit.changed).toBe(true);
        expect(brain.applyTransaction({ type: 'BATCH', payload: commit.forward }).success).toBe(true);
        expect((brain.getNode('g1')!.data as unknown as GroupNodeData).subGraph.nodes.find((n) => n.id === 'b')!.position).toEqual({ x: 50, y: 10 });

        expect(brain.applyTransaction({ type: 'BATCH', payload: commit.inverse }).success).toBe(true);
        const restored = brain.getNode('g1')!.data as unknown as GroupNodeData;
        expect(restored.subGraph).toEqual(original.subGraph);
        expect(restored.boundary).toEqual(original.boundary);
    });

    it('slider group → ungroup restores the Slider node with its value', async () => {
        const nodes = [
            N('s', 'IN-02', -100, { value: 7, min: 0, max: 10, step: 1 }),
            N('b', 'MA-01', 0, { mode: 'ADD' }),
            N('d', 'OT-01', 200, {}),
        ];
        const edges = [E('e1', 's', 'out_a', 'b', 'in_b'), E('e2', 'b', 'out_a', 'd', 'in_a')];
        await brain.injectNodes(
            {
                nodes: nodes.map((n) => ({ id: n.id, type: n.type!, position: n.position, data: n.data ?? {} })),
                edges: edges.map((e) => ({ ...e })),
            },
            true
        );
        const grouped = buildGroupTransactions({ nodes, edges, selectedIds: ['s', 'b'], groupId: 'g1' });
        expect('error' in grouped).toBe(false);
        if ('error' in grouped) return;
        expect(brain.applyTransaction({ type: 'BATCH', payload: grouped.forward }).success).toBe(true);
        expect(brain.getNode('s')).toBeUndefined();

        const ungrouped = buildUngroupTransactions({
            groupId: 'g1',
            groupPosition: { x: 0, y: 0 },
            groupData: cloneData(grouped.group.data),
            mainEdges: brain.getEdges() as LiteEdge[],
        });
        expect(brain.applyTransaction({ type: 'BATCH', payload: ungrouped.forward }).success).toBe(true);
        const slider = brain.getNode('s');
        expect(slider?.type).toBe('IN-02');
        expect((slider?.data as Record<string, unknown>).value).toBe(7);
    });
});

describe('P3 scope portal wiring', () => {
    it('recomputes the boundary from portal edges, carrying port meta', () => {
        const meta: GroupNodeData['boundary'] = {
            inputs: [{ portId: 'in_a__out_a', innerNodeId: 'b', innerHandle: 'in_a', dataType: 'scalar', label: 'Number', defaultValue: 5 }],
            outputs: [{ portId: 'out_d__in_a', innerNodeId: 'c', innerHandle: 'out_a', dataType: 'scalar', label: 'Pow' }],
        };
        // User re-points the input port from b/in_a to b/in_b inside the scope.
        const boundary = deriveBoundaryFromPortalEdges({
            portalInId: '__gp_in_g1',
            portalOutId: '__gp_out_g1',
            portalEdges: [
                { id: 'x1', source: '__gp_in_g1', sourceHandle: 'in_a__out_a', target: 'b', targetHandle: 'in_b' },
                { id: 'x2', source: 'c', sourceHandle: 'out_a', target: '__gp_out_g1', targetHandle: 'out_d__in_a' },
            ],
            meta,
        });
        expect(boundary.inputs).toEqual([
            { portId: 'in_a__out_a', innerNodeId: 'b', innerHandle: 'in_b', dataType: 'scalar', label: 'Number', defaultValue: 5 },
        ]);
        expect(boundary.outputs).toEqual(meta.outputs);
    });
});

function cloneData<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
