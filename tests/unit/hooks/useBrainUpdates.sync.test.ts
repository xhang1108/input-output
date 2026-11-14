/**
 * Parity tests for `applyFullSync` (the full topology sync of useBrainUpdates).
 *
 * The old implementation called `nextNodes.findIndex(n => n.id === id)` for
 * every Brain node (O(n^2)). The rewrite builds an id -> index Map once after
 * the removal pass. These tests pin the OLD observable behaviour so the two
 * implementations stay interchangeable:
 * - in-place updates keep their array index, new nodes append
 * - dirty-chain / input-persistence / editing guards
 * - transient UI keys never come back from Brain
 * - unchanged input returns the same array reference
 * - frames (0) -> roots (1) -> children (2) sort, stable among equal ranks
 * - selection guard (isRestoring / isInteracting)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/react';
import type { NodeLogic } from '@/engine/types/engineTypes';
import { applyFullSync } from '@/hooks/useBrainUpdates';

const NOW = 1_000_000;

function uiNode(id: string, overrides: Partial<Node> = {}): Node {
    return {
        id,
        type: 'mathNode',
        position: { x: 0, y: 0 },
        data: {},
        ...overrides,
    } as Node;
}

function brainNode(id: string, overrides: Partial<NodeLogic> = {}): NodeLogic {
    return {
        id,
        type: 'mathNode',
        position: { x: 0, y: 0 },
        data: {},
        selected: false,
        isInDirtyChain: false,
        ...overrides,
    } as NodeLogic;
}

function toBrainMap(nodes: NodeLogic[]): Map<string, NodeLogic> {
    return new Map(nodes.map(n => [n.id, n]));
}

/**
 * UI node that applyFullSync considers already settled for `brain`.
 * Mirrors what a previous sync pass would have produced, so `changed` is false.
 */
function settledUiNode(b: NodeLogic): Node {
    const width = b.width as number;
    const height = b.height as number;
    const zIndex = b.type === 'frame' ? 0 : (b.parentId ? 100 : undefined);
    return {
        id: b.id,
        type: b.type,
        position: { ...b.position },
        data: { ...b.data },
        parentId: b.parentId,
        width,
        height,
        origin: [0, 0],
        style: { width, height, zIndex },
        selected: b.selected,
    } as unknown as Node;
}

function guard(isRestoring = false, isInteracting = false) {
    return () => ({ isRestoring, isInteracting });
}

function sync(
    current: Node[],
    brain: NodeLogic[],
    options: { recentlyAddedNodes?: Map<string, number>; guard?: boolean[]; now?: number } = {}
) {
    const recentlyAddedNodes = options.recentlyAddedNodes ?? new Map<string, number>();
    const [isRestoring = false, isInteracting = false] = options.guard ?? [];
    const result = applyFullSync(current, toBrainMap(brain), {
        recentlyAddedNodes,
        getSelectionGuard: guard(isRestoring, isInteracting),
        now: () => options.now ?? NOW,
    });
    return { result, recentlyAddedNodes };
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => { });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('applyFullSync', () => {
    it('a) updates value and position in place without moving the node', () => {
        const current = [uiNode('A', { data: { value: 1 }, position: { x: 0, y: 0 } })];
        const brain = [brainNode('A', {
            data: { value: 2 },
            position: { x: 10, y: 10 },
            width: 120,
            height: 40,
        })];

        const { result } = sync(current, brain);

        expect(result).not.toBe(current);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('A');
        expect(result[0].position).toEqual({ x: 10, y: 10 });
        expect(result[0].data).toEqual({ value: 2, width: 120, height: 40 });
        expect(result[0].style).toEqual({ width: 120, height: 40, zIndex: undefined });
        expect(result[0].selected).toBe(false);
    });

    it('b) appends a new Brain node and records it in recentlyAddedNodes', () => {
        const settled = brainNode('A', { data: { value: 1, width: 120, height: 40 }, width: 120, height: 40 });
        const current = [settledUiNode(settled)];
        const fresh = brainNode('B', {
            data: { value: 7, width: 120, height: 40 },
            position: { x: 50, y: 60 },
            width: 120,
            height: 40,
        });

        const { result, recentlyAddedNodes } = sync(current, [settled, fresh]);

        expect(result).not.toBe(current);
        expect(result.map(n => n.id)).toEqual(['A', 'B']);
        expect(result[1].data).toEqual({ value: 7, width: 120, height: 40 });
        expect(result[1].position).toEqual({ x: 50, y: 60 });
        expect(result[1].origin).toEqual([0, 0]);
        expect(recentlyAddedNodes.get('B')).toBe(NOW);
        expect(recentlyAddedNodes.has('A')).toBe(false);
    });

    it('b2) appending does not shift the index of existing nodes (Map stays valid)', () => {
        const settledA = brainNode('A', { data: { value: 1, width: 120, height: 40 }, width: 120, height: 40 });
        const current = [settledUiNode(settledA)];
        // Brain order puts the NEW node first, so the append happens before A is visited.
        const newZ = brainNode('Z', { data: { value: 3, width: 120, height: 40 }, width: 120, height: 40 });
        const movedA = brainNode('A', {
            data: { value: 1, width: 120, height: 40 },
            width: 120,
            height: 40,
            position: { x: 99, y: 99 },
        });

        const { result } = sync(current, [newZ, movedA]);

        // Same ranks -> stable sort keeps nextNodes order: existing A, then appended Z.
        expect(result.map(n => n.id)).toEqual(['A', 'Z']);
        expect(result[0].position).toEqual({ x: 99, y: 99 });
        expect(result[1].id).toBe('Z');
    });

    it('c) removes UI nodes missing from Brain', () => {
        const kept = brainNode('A', { data: { value: 1, width: 120, height: 40 }, width: 120, height: 40 });
        const current = [settledUiNode(kept), uiNode('B', { data: { value: 2 } })];

        const { result } = sync(current, [kept]);

        expect(result).not.toBe(current);
        expect(result.map(n => n.id)).toEqual(['A']);
    });

    it('d) keeps a just-added UI node for 150 ms, then removes it', () => {
        const kept = brainNode('A', { data: { value: 1, width: 120, height: 40 }, width: 120, height: 40 });
        const current = [settledUiNode(kept), uiNode('B', { data: { value: 2 } })];

        const recent = new Map([['B', NOW - 100]]);
        const keptResult = sync(current, [kept], { recentlyAddedNodes: recent, now: NOW });
        expect(keptResult.result.map(n => n.id)).toEqual(['A', 'B']);

        const stale = new Map([['B', NOW - 200]]);
        const removedResult = sync(current, [kept], { recentlyAddedNodes: stale, now: NOW });
        expect(removedResult.result.map(n => n.id)).toEqual(['A']);
    });

    it('e) keeps the UI value of a node inside the dirty chain', () => {
        const current = [uiNode('A', { data: { value: 5 } })];
        const brain = [brainNode('A', {
            data: { value: 9 },
            isInDirtyChain: true,
            width: 120,
            height: 40,
        })];

        const { result } = sync(current, brain);

        expect(result[0].data.value).toBe(5);
        expect(result[0].data).toEqual({ value: 5, width: 120, height: 40 });
    });

    it('e2) trusts the Brain value in the dirty chain when the UI value is nullish', () => {
        const current = [uiNode('A', { data: { value: null } })];
        const brain = [brainNode('A', {
            data: { value: 9 },
            isInDirtyChain: true,
            width: 120,
            height: 40,
        })];

        const { result } = sync(current, brain);

        expect(result[0].data.value).toBe(9);
    });

    it('f) strips transient UI-only keys coming from Brain data', () => {
        const current = [uiNode('A', { data: { value: 0 } })];
        const brain = [brainNode('A', {
            data: {
                value: 0,
                label: 'kept',
                isEditing: true,
                isTyping: true,
                isPending: true,
            },
            width: 120,
            height: 40,
        })];

        const { result } = sync(current, brain);

        expect(result[0].data).toEqual({ value: 0, label: 'kept', width: 120, height: 40 });
        expect(result[0].data).not.toHaveProperty('isEditing');
        expect(result[0].data).not.toHaveProperty('isTyping');
        expect(result[0].data).not.toHaveProperty('isPending');
    });

    it('g) returns the same array reference and node objects when nothing changed', () => {
        const brain = brainNode('A', { data: { value: 1, width: 120, height: 40 }, width: 120, height: 40 });
        const current = [settledUiNode(brain)];

        const { result } = sync(current, [brain]);

        expect(result).toBe(current);
        expect(result[0]).toBe(current[0]);
    });

    it('g2) does not mutate the incoming array or its nodes', () => {
        const current = [uiNode('A', { data: { value: 1 } })];
        const snapshot = current[0];
        const brain = [brainNode('A', { data: { value: 2 }, width: 120, height: 40 })];

        sync(current, brain);

        expect(current).toHaveLength(1);
        expect(current[0]).toBe(snapshot);
        expect(snapshot.data).toEqual({ value: 1 });
    });

    it('h) sorts frames, then roots, then children once something changed (stable among equal ranks)', () => {
        const frameF = brainNode('F', { type: 'frame', data: { width: 400, height: 300 }, width: 400, height: 300 });
        const childC = brainNode('C', {
            parentId: 'F',
            data: { value: 1, width: 120, height: 40 },
            width: 120,
            height: 40,
        });
        const rootR1 = brainNode('R1', { data: { value: 1, width: 120, height: 40 }, width: 120, height: 40 });
        const rootR2 = brainNode('R2', { data: { value: 2, width: 120, height: 40 }, width: 120, height: 40 });

        // UI order is deliberately scrambled; C comes before its frame.
        const current = [
            settledUiNode(childC),
            settledUiNode(rootR2),
            settledUiNode(frameF),
            settledUiNode(rootR1),
        ];
        // One real change forces the sort.
        const movedR1 = brainNode('R1', {
            data: { value: 1, width: 120, height: 40 },
            width: 120,
            height: 40,
            position: { x: 5, y: 5 },
        });

        const { result } = sync(current, [frameF, childC, movedR1, rootR2]);

        expect(result.map(n => n.id)).toEqual(['F', 'R2', 'R1', 'C']);
        expect(result[0].type).toBe('frame');
        expect(result[0].origin).toEqual([0, 0]);
        expect(result[0].style).toEqual({ width: 400, height: 300, zIndex: 0 });
        expect(result[3].parentId).toBe('F');
        expect(result[3].style).toEqual({ width: 120, height: 40, zIndex: 100 });
    });

    it('i) preserves UI selection while interacting', () => {
        const current = [uiNode('A', { data: { value: 1 }, selected: true })];
        const brain = [brainNode('A', {
            data: { value: 2 },
            selected: false,
            position: { x: 10, y: 0 },
            width: 120,
            height: 40,
        })];

        const { result } = sync(current, brain, { guard: [false, true] });

        expect(result[0].selected).toBe(true);
        expect(result[0].position).toEqual({ x: 10, y: 0 });
    });

    it('i2) preserves UI selection while restoring history', () => {
        const current = [uiNode('A', { data: { value: 1 }, selected: true })];
        const brain = [brainNode('A', {
            data: { value: 2 },
            selected: false,
            position: { x: 10, y: 0 },
            width: 120,
            height: 40,
        })];

        const { result } = sync(current, brain, { guard: [true, false] });

        expect(result[0].selected).toBe(true);
    });

    it('i3) applies Brain selection when the canvas is idle', () => {
        const current = [uiNode('A', { data: { value: 1 }, selected: true })];
        const brain = [brainNode('A', { data: { value: 1 }, selected: false, width: 120, height: 40 })];

        const { result } = sync(current, brain);

        expect(result[0].selected).toBe(false);
    });

    it('keeps a persisted input value when the engine reports a transient null', () => {
        const current = [uiNode('IN-01', { type: 'IN-01', data: { value: 3 } })];
        const brain = [brainNode('IN-01', {
            type: 'IN-01',
            data: { value: null },
            width: 120,
            height: 40,
        })];

        const { result } = sync(current, brain);

        expect(result[0].data.value).toBe(3);
    });

    it('keeps first-occurrence semantics for duplicate UI ids (findIndex parity)', () => {
        const brain = [brainNode('A', { data: { value: 2 }, width: 120, height: 40 })];
        const first = uiNode('A', { data: { value: 1 } });
        const duplicate = uiNode('A', { data: { value: 42 } });
        const current = [first, duplicate];

        const { result } = sync(current, brain);

        expect(result).toHaveLength(2);
        expect(result[0].data.value).toBe(2);
        expect(result[1]).toBe(duplicate);
    });

    it('keeps editing nodes untouched while still updating others', () => {
        const editing = uiNode('A', { data: { value: 1, isEditing: true } });
        const brain = [brainNode('A', { data: { value: 2 }, width: 120, height: 40 })];

        const { result } = sync([editing], brain);

        // Data is protected; position/style checks still run (here: no change).
        expect(result[0].data).toBe(editing.data);
        expect(result[0].data.value).toBe(1);
        // Width/height are still written from Brain.
        expect(result[0].width).toBe(120);
    });
});
