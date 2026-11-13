import { describe, expect, it } from 'vitest';
import {
    depthOf,
    getEffectiveRoots,
    indexNodes,
    isDescendant,
    reparentPosition,
    sortParentFirst,
    toAbsolute,
    toParentLocal,
    validateHierarchy,
    type CoordinateNode,
} from '@/utils/coordinates';

function node(
    id: string,
    x: number,
    y: number,
    parentId?: string
): CoordinateNode {
    return { id, position: { x, y }, parentId };
}

function lookup(nodes: CoordinateNode[]): Map<string, CoordinateNode> {
    return new Map(nodes.map(n => [n.id, n]));
}

describe('coordinates.toAbsolute', () => {
    it('keeps root positions unchanged (flat baseline)', () => {
        const nodes = lookup([
            node('a', 10, 20),
            node('b', -30, 40),
        ]);

        expect(toAbsolute(nodes, 'a')).toEqual({ x: 10, y: 20 });
        expect(toAbsolute(nodes, 'b')).toEqual({ x: -30, y: 40 });
    });

    it('adds the parent absolute position for children', () => {
        const nodes = lookup([
            node('root', 100, 200),
            node('child', 10, 20, 'root'),
        ]);

        expect(toAbsolute(nodes, 'child')).toEqual({ x: 110, y: 220 });
    });

    it('supports multiple levels', () => {
        const nodes = lookup([
            node('root', 100, 200),
            node('child', 10, 20, 'root'),
            node('grandchild', -5, 7, 'child'),
        ]);

        expect(toAbsolute(nodes, 'grandchild')).toEqual({ x: 105, y: 227 });
    });

    it('supports negative parents and deeper chains', () => {
        const nodes = lookup([
            node('root', -100, -200),
            node('child', 30, 40, 'root'),
            node('grandchild', -10, -20, 'child'),
            node('great', 5, 6, 'grandchild'),
        ]);

        expect(toAbsolute(nodes, 'child')).toEqual({ x: -70, y: -160 });
        expect(toAbsolute(nodes, 'great')).toEqual({ x: -75, y: -174 });
    });

    it('treats local position as absolute when the parent is missing', () => {
        const nodes = lookup([node('orphan', 50, 60, 'missing')]);

        expect(toAbsolute(nodes, 'orphan')).toEqual({ x: 50, y: 60 });
    });

    it('returns 0,0 for unknown ids', () => {
        expect(toAbsolute(lookup([]), 'nope')).toEqual({ x: 0, y: 0 });
    });

    it('terminates on cycles and counts each node once', () => {
        const nodes = lookup([
            node('a', 10, 10, 'b'),
            node('b', 5, 5, 'a'),
        ]);

        expect(toAbsolute(nodes, 'a')).toEqual({ x: 15, y: 15 });
        expect(toAbsolute(nodes, 'b')).toEqual({ x: 15, y: 15 });
    });

    it('counts a self-parented node once', () => {
        const nodes = lookup([node('a', 7, 9, 'a')]);

        expect(toAbsolute(nodes, 'a')).toEqual({ x: 7, y: 9 });
    });
});

describe('coordinates.toParentLocal', () => {
    it('round-trips every node in a valid tree', () => {
        const nodes: CoordinateNode[] = [
            node('root', 100, 200),
            node('child', 10, 20, 'root'),
            node('grandchild', -5, 7, 'child'),
        ];
        const map = lookup(nodes);

        for (const n of nodes) {
            const absolute = toAbsolute(map, n.id);
            expect(toParentLocal(map, n.id, absolute)).toEqual(n.position);
        }
    });

    it('returns absolute for roots, orphans and self-parented nodes', () => {
        const nodes = lookup([
            node('root', 100, 200),
            node('orphan', 50, 60, 'missing'),
            node('self', 7, 9, 'self'),
        ]);

        expect(toParentLocal(nodes, 'root', { x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
        expect(toParentLocal(nodes, 'orphan', { x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
        expect(toParentLocal(nodes, 'self', { x: 7, y: 9 })).toEqual({ x: 7, y: 9 });
    });
});

describe('coordinates.reparentPosition', () => {
    it('detaches to absolute without losing the world position', () => {
        const nodes = lookup([
            node('parent', 100, 200),
            node('child', 30, 40, 'parent'),
        ]);

        expect(reparentPosition(nodes, 'child', null, { x: 130, y: 240 }))
            .toEqual({ x: 130, y: 240 });
    });

    it('converts world to the new parent local', () => {
        const nodes = lookup([
            node('old', 0, 0),
            node('child', 10, 10, 'old'),
            node('new', 100, 200),
        ]);

        expect(reparentPosition(nodes, 'child', 'new', { x: 130, y: 240 }))
            .toEqual({ x: 30, y: 40 });
    });

    it('rejects self-parent, missing parents and descendant loops', () => {
        const nodes = lookup([
            node('root', 0, 0),
            node('child', 10, 10, 'root'),
            node('grandchild', 5, 5, 'child'),
        ]);

        expect(reparentPosition(nodes, 'root', 'root', { x: 0, y: 0 })).toBeUndefined();
        expect(reparentPosition(nodes, 'child', 'missing', { x: 0, y: 0 })).toBeUndefined();
        expect(reparentPosition(nodes, 'root', 'grandchild', { x: 0, y: 0 })).toBeUndefined();
        expect(reparentPosition(nodes, 'missing', 'root', { x: 0, y: 0 })).toBeUndefined();
    });
});

describe('coordinates.indexNodes', () => {
    it('indexes by id', () => {
        const nodes = [node('a', 0, 0), node('b', 1, 1)];
        const map = indexNodes(nodes);

        expect(map.get('a')).toBe(nodes[0]);
        expect(map.get('b')).toBe(nodes[1]);
    });
});

describe('coordinates.depthOf', () => {
    it('counts root as 0 and children upward', () => {
        const nodes = lookup([
            node('root', 0, 0),
            node('child', 0, 0, 'root'),
            node('grandchild', 0, 0, 'child'),
        ]);

        expect(depthOf(nodes, 'root')).toBe(0);
        expect(depthOf(nodes, 'child')).toBe(1);
        expect(depthOf(nodes, 'grandchild')).toBe(2);
    });

    it('returns -1 for unknown nodes and cycles', () => {
        const nodes = lookup([
            node('a', 0, 0, 'b'),
            node('b', 0, 0, 'a'),
        ]);

        expect(depthOf(nodes, 'missing')).toBe(-1);
        expect(depthOf(nodes, 'a')).toBe(-1);
    });
});

describe('coordinates.isDescendant', () => {
    it('detects descendants and rejects unrelated nodes', () => {
        const nodes = lookup([
            node('root', 0, 0),
            node('child', 0, 0, 'root'),
            node('grandchild', 0, 0, 'child'),
            node('other', 0, 0),
        ]);

        expect(isDescendant(nodes, 'child', 'root')).toBe(true);
        expect(isDescendant(nodes, 'grandchild', 'root')).toBe(true);
        expect(isDescendant(nodes, 'root', 'grandchild')).toBe(false);
        expect(isDescendant(nodes, 'other', 'root')).toBe(false);
        expect(isDescendant(nodes, 'root', 'root')).toBe(false);
    });

    it('terminates on cycles and missing parents', () => {
        const nodes = lookup([
            node('a', 0, 0, 'b'),
            node('b', 0, 0, 'a'),
            node('orphan', 0, 0, 'missing'),
        ]);

        expect(typeof isDescendant(nodes, 'a', 'b')).toBe('boolean');
        expect(typeof isDescendant(nodes, 'b', 'a')).toBe('boolean');
        expect(isDescendant(nodes, 'orphan', 'root')).toBe(false);
        expect(typeof isDescendant(nodes, 'missing', 'root')).toBe('boolean');
    });
});

describe('coordinates.getEffectiveRoots', () => {
    const nodes = [
        node('root', 0, 0),
        node('child', 10, 10, 'root'),
        node('grandchild', 5, 5, 'child'),
        node('other', 20, 20),
    ];

    it('drops selected nodes whose ancestor is also selected', () => {
        const selected = new Set(['root', 'child', 'grandchild']);

        expect(getEffectiveRoots(nodes, selected).map(n => n.id)).toEqual(['root']);
    });

    it('keeps a selected child when the parent is not selected', () => {
        const selected = new Set(['child', 'grandchild']);

        expect(getEffectiveRoots(nodes, selected).map(n => n.id)).toEqual(['child']);
    });

    it('keeps independent roots', () => {
        const selected = new Set(['root', 'other']);

        expect(getEffectiveRoots(nodes, selected).map(n => n.id)).toEqual(['root', 'other']);
    });

    it('treats a self-parented node as a movable root', () => {
        const self = [node('a', 0, 0, 'a')];

        expect(getEffectiveRoots(self, new Set(['a'])).map(n => n.id)).toEqual(['a']);
    });

    it('terminates on a cycle', () => {
        const cyclic = [
            node('a', 0, 0, 'b'),
            node('b', 0, 0, 'a'),
        ];

        expect(() => getEffectiveRoots(cyclic, new Set(['a', 'b']))).not.toThrow();
    });
});

describe('coordinates.sortParentFirst', () => {
    it('places parents before children even when declared later', () => {
        const nodes = [
            node('grandchild', 0, 0, 'child'),
            node('child', 0, 0, 'root'),
            node('root', 0, 0),
        ];

        expect(sortParentFirst(nodes).map(n => n.id)).toEqual([
            'root',
            'child',
            'grandchild',
        ]);
    });

    it('keeps the original order for equal depths (stable)', () => {
        const nodes = [
            node('b', 0, 0),
            node('a', 0, 0),
            node('d', 0, 0),
            node('c', 0, 0),
        ];

        expect(sortParentFirst(nodes).map(n => n.id)).toEqual(['b', 'a', 'd', 'c']);
    });

    it('keeps an orphan chain parent-first', () => {
        const nodes = [
            node('child', 0, 0, 'orphan'),
            node('orphan', 0, 0, 'missing'),
        ];

        expect(sortParentFirst(nodes).map(n => n.id)).toEqual(['orphan', 'child']);
    });
});

describe('coordinates.validateHierarchy', () => {
    it('accepts a valid tree', () => {
        const nodes = [
            node('root', 0, 0),
            node('child', 0, 0, 'root'),
        ];

        expect(validateHierarchy(nodes)).toEqual([]);
    });

    it('reports self-parent once and does not also call it a cycle', () => {
        const issues = validateHierarchy([node('a', 0, 0, 'a')]);

        expect(issues.map(i => i.code)).toEqual(['self-parent']);
    });

    it('reports missing parents', () => {
        const issues = validateHierarchy([node('a', 0, 0, 'ghost')]);

        expect(issues.map(i => i.code)).toContain('missing-parent');
    });

    it('reports duplicate ids once', () => {
        const issues = validateHierarchy([
            node('dup', 0, 0),
            node('dup', 10, 10),
        ]).filter(i => i.code === 'duplicate-id');

        expect(issues).toHaveLength(1);
        expect(issues[0].nodeId).toBe('dup');
    });

    it('reports a cycle once with a deterministic node id', () => {
        const issues = validateHierarchy([
            node('tail', 0, 0, 'b'),
            node('c', 0, 0, 'b'),
            node('b', 0, 0, 'c'),
        ]).filter(i => i.code === 'cycle');

        expect(issues).toHaveLength(1);
        expect(issues[0].nodeId).toBe('b');
    });

    it('enforces maxDepth for the single-level frame rule', () => {
        const nodes = [
            node('root', 0, 0),
            node('child', 0, 0, 'root'),
            node('grandchild', 0, 0, 'child'),
        ];

        expect(validateHierarchy(nodes, { maxDepth: 1 }).map(i => i.nodeId))
            .toEqual(['grandchild']);
    });

    it('handles maxDepth 0 and omitted maxDepth', () => {
        const nodes = [
            node('root', 0, 0),
            node('child', 0, 0, 'root'),
        ];

        expect(validateHierarchy(nodes, { maxDepth: 0 }).map(i => i.code))
            .toEqual(['max-depth-exceeded']);
        expect(validateHierarchy(nodes).some(i => i.code === 'max-depth-exceeded'))
            .toBe(false);
    });

    it('does not report maxDepth for an orphan chain', () => {
        const nodes = [
            node('orphan', 0, 0, 'missing'),
            node('child', 0, 0, 'orphan'),
        ];

        const codes = validateHierarchy(nodes, { maxDepth: 1 }).map(i => i.code);

        expect(codes).toContain('missing-parent');
        expect(codes).not.toContain('max-depth-exceeded');
    });
});
