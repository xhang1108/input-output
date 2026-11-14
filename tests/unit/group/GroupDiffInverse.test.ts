import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { Brain } from '@/engine/Brain';
import { NodeRegistry } from '@/engine/NodeRegistry';
import {
    buildCommitTransactions,
    buildGroupTransactions,
    buildScopeDraftNode,
    type LiteEdge,
    type LiteNode,
} from '@/hooks/useGroupActions';
import type { GroupNodeData, LeanNode } from '@/types/groupNode';

// GROUP_NODE_PLAN F1 (diff-inverse) + F2 (scope palette):
// - exit-commit inverse is a PATCH_SUBGRAPH node diff, not a full clone;
// - scope spawns are view-local drafts committed back on exit.

beforeAll(() => {
    NodeRegistry.initializeNodes();
});

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

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

// 199-node chain grouped (m0..m198), m199 left outside so the boundary has
// one output port — the realistic large-group shape for the bytes gate.
function chain199() {
    const nodes: LiteNode[] = [];
    const edges: ReturnType<typeof E>[] = [];
    for (let i = 0; i < 199; i++) {
        nodes.push(N(`m${i}`, 'MA-01', i * 10, { mode: 'ADD' }));
        if (i > 0) edges.push(E(`e${i}`, `m${i - 1}`, 'out_a', `m${i}`, 'in_a'));
    }
    nodes.push(N('m199', 'OT-01', 1990, {}));
    edges.push(E('e_out', 'm198', 'out_a', 'm199', 'in_a'));
    return { nodes, edges };
}

describe('F1 diff-inverse commit', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    afterEach(() => {
        brain.dispose();
    });

    it('200-node group + 1 scope node: undo restores equivalence, inverse < 10% of full clone', async () => {
        const { nodes, edges } = chain199();
        const selected = nodes.filter((n) => n.id !== 'm199').map((n) => n.id);
        expect(selected).toHaveLength(199);
        const grouped = buildGroupTransactions({ nodes, edges, selectedIds: selected, groupId: 'g1' });
        expect('error' in grouped).toBe(false);
        if ('error' in grouped) return;

        await brain.injectNodes(
            {
                nodes: nodes.map((n) => ({ id: n.id, type: n.type!, position: n.position, data: n.data ?? {} })),
                edges: edges.map((e) => ({ ...e })),
            },
            true
        );
        expect(brain.applyTransaction({ type: 'BATCH', payload: grouped.forward }).success).toBe(true);

        const original = clone({
            subGraph: grouped.group.data.subGraph,
            boundary: grouped.group.data.boundary,
        });
        // Scope edit: isolated node added, nothing else touched.
        const next = clone(original);
        next.subGraph.nodes.push({
            id: 'draft_1',
            type: 'MA-01',
            position: { x: 5, y: 5 },
            data: { mode: 'ADD' },
        } satisfies LeanNode);

        const commit = buildCommitTransactions({
            groupId: 'g1',
            original,
            next,
            mainEdges: brain.getEdges() as LiteEdge[],
        });
        expect(commit.changed).toBe(true);
        expect(commit.forward[0]).toMatchObject({ type: 'UPDATE_NODE_DATA' });
        expect(commit.inverse[0]).toMatchObject({ type: 'PATCH_SUBGRAPH' });

        // Bytes gate (order of magnitude, not exact): the diff inverse must
        // be < 10% of the old full-clone inverse.
        const fullCloneInverse = [
            {
                type: 'UPDATE_NODE_DATA',
                payload: {
                    id: 'g1',
                    data: {
                        subGraph: original.subGraph,
                        boundary: original.boundary,
                        handles: grouped.group.data.handles,
                    },
                },
            },
        ];
        const inverseBytes = JSON.stringify(commit.inverse).length;
        const fullBytes = JSON.stringify(fullCloneInverse).length;
        expect(fullBytes).toBeGreaterThan(10000);
        expect(inverseBytes).toBeLessThan(fullBytes * 0.1);

        const beforePatch = (brain.getNode('g1')!.data as unknown as GroupNodeData).subGraph;
        expect(brain.applyTransaction({ type: 'BATCH', payload: commit.forward }).success).toBe(true);
        expect((brain.getNode('g1')!.data as unknown as GroupNodeData).subGraph.nodes).toHaveLength(200);

        expect(brain.applyTransaction({ type: 'BATCH', payload: commit.inverse }).success).toBe(true);
        const restored = brain.getNode('g1')!.data as unknown as GroupNodeData;
        expect(restored.subGraph).toEqual(original.subGraph);
        expect(restored.boundary).toEqual(original.boundary);
        // planCache contract: the patch allocates fresh objects, never
        // mutates the cached identity in place.
        expect(restored.subGraph).not.toBe(beforePatch);
    });

    it('modified + deleted + added nodes and edge changes restore exactly', async () => {
        const nodes = [
            N('a', 'IN-01', -200, { value: 2 }),
            N('b', 'MA-01', 0, { mode: 'ADD' }),
            N('c', 'MA-02', 200, { mode: 'POW' }),
            N('d', 'OT-01', 400, {}),
        ];
        const edges = [
            E('e1', 'a', 'out_a', 'b', 'in_a'),
            E('e2', 'b', 'out_a', 'c', 'in_a'),
            E('e3', 'c', 'out_a', 'd', 'in_a'),
        ];
        const grouped = buildGroupTransactions({ nodes, edges, selectedIds: ['b', 'c'], groupId: 'g1' });
        expect('error' in grouped).toBe(false);
        if ('error' in grouped) return;
        await brain.injectNodes(
            {
                nodes: nodes.map((n) => ({ id: n.id, type: n.type!, position: n.position, data: n.data ?? {} })),
                edges: edges.map((e) => ({ ...e })),
            },
            true
        );
        expect(brain.applyTransaction({ type: 'BATCH', payload: grouped.forward }).success).toBe(true);

        const original = clone({
            subGraph: grouped.group.data.subGraph,
            boundary: grouped.group.data.boundary,
        });
        const next = clone(original);
        // modify b, delete c, add x wired to b, drop the inner edge.
        next.subGraph.nodes.find((n) => n.id === 'b')!.position = { x: 50, y: 10 };
        next.subGraph.nodes = next.subGraph.nodes.filter((n) => n.id !== 'c');
        next.subGraph.nodes.push({ id: 'x', type: 'MA-01', position: { x: 9, y: 9 }, data: { mode: 'ADD' } });
        next.subGraph.edges = [{ id: 'e_new', source: 'b', sourceHandle: 'out_a', target: 'x', targetHandle: 'in_a' }];

        const commit = buildCommitTransactions({
            groupId: 'g1',
            original,
            next,
            mainEdges: brain.getEdges() as LiteEdge[],
        });
        expect(commit.changed).toBe(true);
        const patch = commit.inverse[0].payload as {
            put: LeanNode[];
            remove: string[];
            edges: unknown[];
        };
        // deleted c restores full text, modified b restores previous text,
        // added x drops by id; edges ride along because the set changed.
        expect(patch.put.map((n) => n.id).sort()).toEqual(['b', 'c']);
        expect(patch.put.find((n) => n.id === 'b')!.position).toEqual({ x: 0, y: 0 });
        expect(patch.remove).toEqual(['x']);
        expect(patch.edges).toEqual(original.subGraph.edges);

        expect(brain.applyTransaction({ type: 'BATCH', payload: commit.forward }).success).toBe(true);
        expect(brain.applyTransaction({ type: 'BATCH', payload: commit.inverse }).success).toBe(true);
        const restored = brain.getNode('g1')!.data as unknown as GroupNodeData;
        expect(restored.subGraph).toEqual(original.subGraph);
        expect(restored.boundary).toEqual(original.boundary);
    });

    it('PATCH_SUBGRAPH on a missing node fails cleanly', () => {
        const res = brain.applyTransaction({
            type: 'PATCH_SUBGRAPH',
            payload: { id: 'nope', put: [], remove: [] },
        });
        expect(res.success).toBe(false);
    });
});

describe('F2 scope palette draft', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    afterEach(() => {
        brain.dispose();
    });

    it('rejects group/frame nesting (D2)', () => {
        expect(buildScopeDraftNode({ type: 'group', label: 'Group', position: { x: 0, y: 0 } })).toBeNull();
        expect(buildScopeDraftNode({ type: 'frame', label: 'Frame', position: { x: 0, y: 0 } })).toBeNull();
        const ok = buildScopeDraftNode({ type: 'MA-01', label: 'Math', position: { x: 1, y: 2 } });
        expect(ok).not.toBeNull();
        expect(ok!.id).toMatch(/^MA-01_/);
        expect(ok!.position).toEqual({ x: 1, y: 2 });
    });

    it('scope add → commit lands in main graph → undo restores', async () => {
        const nodes = [
            N('a', 'IN-01', -200, { value: 2 }),
            N('b', 'MA-01', 0, { mode: 'ADD' }),
            N('c', 'MA-02', 200, { mode: 'POW' }),
            N('d', 'OT-01', 400, {}),
        ];
        const edges = [
            E('e1', 'a', 'out_a', 'b', 'in_a'),
            E('e2', 'b', 'out_a', 'c', 'in_a'),
            E('e3', 'c', 'out_a', 'd', 'in_a'),
        ];
        const grouped = buildGroupTransactions({ nodes, edges, selectedIds: ['b', 'c'], groupId: 'g1' });
        expect('error' in grouped).toBe(false);
        if ('error' in grouped) return;
        await brain.injectNodes(
            {
                nodes: nodes.map((n) => ({ id: n.id, type: n.type!, position: n.position, data: n.data ?? {} })),
                edges: edges.map((e) => ({ ...e })),
            },
            true
        );
        expect(brain.applyTransaction({ type: 'BATCH', payload: grouped.forward }).success).toBe(true);

        const original = clone({
            subGraph: grouped.group.data.subGraph,
            boundary: grouped.group.data.boundary,
        });
        // Scope spawn: view-local draft node + a draft wire, then commit.
        const draft = buildScopeDraftNode({ type: 'MA-01', label: 'Math', position: { x: 100, y: 50 } });
        expect(draft).not.toBeNull();
        expect(brain.getNode(draft!.id)).toBeUndefined();
        const next = clone(original);
        next.subGraph.nodes.push({
            id: draft!.id,
            type: (draft!.type as string) || 'baseNode',
            position: { ...(draft!.position as { x: number; y: number }) },
            data: clone((draft!.data as Record<string, unknown>) ?? {}),
        });
        next.subGraph.edges.push({
            id: 'e_draft',
            source: 'b',
            sourceHandle: 'out_a',
            target: draft!.id,
            targetHandle: 'in_a',
        });

        const commit = buildCommitTransactions({
            groupId: 'g1',
            original,
            next,
            mainEdges: brain.getEdges() as LiteEdge[],
        });
        expect(commit.changed).toBe(true);
        expect(brain.applyTransaction({ type: 'BATCH', payload: commit.forward }).success).toBe(true);
        const committed = brain.getNode('g1')!.data as unknown as GroupNodeData;
        expect(committed.subGraph.nodes.map((n) => n.id)).toContain(draft!.id);
        expect(committed.subGraph.edges.map((e) => e.id)).toContain('e_draft');

        expect(brain.applyTransaction({ type: 'BATCH', payload: commit.inverse }).success).toBe(true);
        const restored = brain.getNode('g1')!.data as unknown as GroupNodeData;
        expect(restored.subGraph).toEqual(original.subGraph);
        expect(restored.boundary).toEqual(original.boundary);
    });
});
