import { describe, expect, it } from 'vitest';
import {
    sanitizeHierarchy,
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

describe('coordinates.sanitizeHierarchy', () => {
    it('returns valid nodes untouched (no position or parent drift)', () => {
        const input: CoordinateNode[] = [
            node('f1', 100, 200),
            node('child', 20, 30, 'f1'),
            node('root', -5, 7),
        ];

        const result = sanitizeHierarchy(input, { maxDepth: 1 });

        expect(result.issues).toEqual([]);
        expect(result.nodes[0]).toBe(input[0]);
        expect(result.nodes[1]).toBe(input[1]);
        expect(result.nodes[2]).toBe(input[2]);
        expect(result.nodes[1].position).toBe(input[1].position);
    });

    it('detaches an orphan to its local position (parent already missing)', () => {
        const result = sanitizeHierarchy([node('orphan', 50, 60, 'ghost')], { maxDepth: 1 });

        expect(result.nodes[0].parentId).toBeUndefined();
        expect(result.nodes[0].position).toEqual({ x: 50, y: 60 });
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].code).toBe('missing-parent');
        expect(result.issues[0].message).toContain('missing parent "ghost"');
    });

    it('detaches a self-parent without shifting it', () => {
        const result = sanitizeHierarchy([node('self', 7, 9, 'self')], { maxDepth: 1 });

        expect(result.nodes[0].parentId).toBeUndefined();
        expect(result.nodes[0].position).toEqual({ x: 7, y: 9 });
        expect(result.issues.map(i => i.code)).toEqual(['self-parent']);
    });

    it('detaches every member of a cycle and keeps a stable world position', () => {
        const result = sanitizeHierarchy([
            node('a', 10, 10, 'b'),
            node('b', 5, 5, 'a'),
        ], { maxDepth: 1 });

        for (const repaired of result.nodes) {
            expect(repaired.parentId).toBeUndefined();
            expect(repaired.position).toEqual({ x: 15, y: 15 });
        }
        expect(result.issues.map(i => i.code)).toEqual(['cycle', 'cycle']);
        expect(result.issues[0].message).toContain('Cycle detected: a -> b -> a');
    });

    it('detaches only the node exceeding maxDepth, keeping its ancestor chain', () => {
        const result = sanitizeHierarchy([
            node('f1', 100, 200),
            node('f2', 10, 20, 'f1'),
            node('n', 3, 4, 'f2'),
        ], { maxDepth: 1 });

        expect(result.nodes[1].parentId).toBe('f1');
        expect(result.nodes[1].position).toEqual({ x: 10, y: 20 });

        expect(result.nodes[2].parentId).toBeUndefined();
        expect(result.nodes[2].position).toEqual({ x: 113, y: 224 });

        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]).toMatchObject({
            code: 'max-depth-exceeded',
            nodeId: 'n',
        });
        expect(result.issues[0].message).toContain('depth 2');
    });

    it('does not enforce depth when maxDepth is omitted', () => {
        const result = sanitizeHierarchy([
            node('root', 0, 0),
            node('child', 1, 1, 'root'),
            node('grandchild', 2, 2, 'child'),
        ]);

        expect(result.issues).toEqual([]);
        expect(result.nodes[2].parentId).toBe('child');
    });

    it('keeps children of a detached node attached at their world position', () => {
        const result = sanitizeHierarchy([
            node('orphan', 100, 100, 'ghost'),
            node('child', 10, 20, 'orphan'),
        ], { maxDepth: 1 });

        expect(result.nodes[0].parentId).toBeUndefined();
        expect(result.nodes[0].position).toEqual({ x: 100, y: 100 });
        expect(result.nodes[1].parentId).toBe('orphan');
        expect(result.nodes[1].position).toEqual({ x: 10, y: 20 });
        expect(result.issues).toHaveLength(1);
    });
});
