import { beforeEach, describe, expect, it } from 'vitest';
import { Brain } from '@/engine/Brain';

/**
 * `Brain.injectNodes` must not accept a broken hierarchy. Orphan, self-parent,
 * cycle and multi-level links are detached to world coordinates and reported in
 * the returned diagnostics. Valid graphs must load exactly as written.
 */
describe('Brain.injectNodes hierarchy sanitization', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getComputeSession('test-hierarchy-sanitize');
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('loads a valid frame graph without diagnostics or drift', async () => {
        const diagnostics = await brain.injectNodes({
            nodes: [
                { id: 'f1', type: 'frame', position: { x: 100, y: 200 }, width: 400, height: 300, data: { label: 'Group 1' } },
                { id: 'n1', type: 'IN-01', position: { x: 20, y: 30 }, parentId: 'f1', data: { value: 42 } },
            ],
            edges: [],
        }, true);

        expect(diagnostics).toEqual([]);
        expect(brain.getNode('f1')?.position).toEqual({ x: 100, y: 200 });
        expect(brain.getNode('n1')?.parentId).toBe('f1');
        expect(brain.getNode('n1')?.position).toEqual({ x: 20, y: 30 });
    });

    it('detaches an orphan parent and reports it', async () => {
        const diagnostics = await brain.injectNodes({
            nodes: [
                { id: 'n1', type: 'IN-01', position: { x: 50, y: 60 }, parentId: 'ghost', data: { value: 1 } },
            ],
            edges: [],
        }, true);

        expect(brain.getNode('n1')?.parentId).toBeUndefined();
        expect(brain.getNode('n1')?.position).toEqual({ x: 50, y: 60 });
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toContain('Hierarchy:');
        expect(diagnostics[0]).toContain('missing parent "ghost"');
        expect(diagnostics[0]).toContain('world coordinates (50, 60)');
    });

    it('detaches a self-parent and reports it', async () => {
        const diagnostics = await brain.injectNodes({
            nodes: [
                { id: 'n1', type: 'IN-01', position: { x: 7, y: 9 }, parentId: 'n1', data: { value: 1 } },
            ],
            edges: [],
        }, true);

        expect(brain.getNode('n1')?.parentId).toBeUndefined();
        expect(brain.getNode('n1')?.position).toEqual({ x: 7, y: 9 });
        expect(diagnostics.some(d => d.includes('is its own parent'))).toBe(true);
    });

    it('breaks a parent cycle by detaching both nodes', async () => {
        const diagnostics = await brain.injectNodes({
            nodes: [
                { id: 'a', type: 'IN-01', position: { x: 10, y: 10 }, parentId: 'b', data: { value: 1 } },
                { id: 'b', type: 'OT-01', position: { x: 5, y: 5 }, parentId: 'a' },
            ],
            edges: [],
        }, true);

        expect(brain.getNode('a')?.parentId).toBeUndefined();
        expect(brain.getNode('b')?.parentId).toBeUndefined();
        expect(brain.getNode('a')?.position).toEqual({ x: 15, y: 15 });
        expect(brain.getNode('b')?.position).toEqual({ x: 15, y: 15 });
        expect(diagnostics.filter(d => d.includes('Cycle detected'))).toHaveLength(2);
    });

    it('detaches a node deeper than one level and keeps ancestors attached', async () => {
        const diagnostics = await brain.injectNodes({
            nodes: [
                { id: 'f1', type: 'frame', position: { x: 100, y: 200 }, width: 400, height: 300, data: { label: 'Outer' } },
                { id: 'f2', type: 'frame', position: { x: 10, y: 20 }, parentId: 'f1', width: 200, height: 150, data: { label: 'Inner' } },
                { id: 'n1', type: 'IN-01', position: { x: 3, y: 4 }, parentId: 'f2', data: { value: 1 } },
            ],
            edges: [],
        }, true);

        expect(brain.getNode('f2')?.parentId).toBe('f1');
        expect(brain.getNode('f2')?.position).toEqual({ x: 10, y: 20 });

        expect(brain.getNode('n1')?.parentId).toBeUndefined();
        expect(brain.getNode('n1')?.position).toEqual({ x: 113, y: 224 });

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toContain('depth 2');
    });

    it('still migrates a valid legacy data.parentId', async () => {
        const diagnostics = await brain.injectNodes({
            nodes: [
                { id: 'f1', type: 'frame', position: { x: 0, y: 0 }, width: 300, height: 200, data: { label: 'Group' } },
                { id: 'n1', type: 'IN-01', position: { x: 12, y: 34 }, data: { value: 1, parentId: 'f1' } },
            ],
            edges: [],
        }, true);

        expect(diagnostics).toEqual([]);
        expect(brain.getNode('n1')?.parentId).toBe('f1');
        expect(brain.getNode('n1')?.position).toEqual({ x: 12, y: 34 });
    });

    it('detaches an invalid legacy data.parentId and reports it', async () => {
        const diagnostics = await brain.injectNodes({
            nodes: [
                { id: 'n1', type: 'IN-01', position: { x: 40, y: 50 }, data: { value: 1, parentId: 'ghost' } },
            ],
            edges: [],
        }, true);

        expect(brain.getNode('n1')?.parentId).toBeUndefined();
        expect(brain.getNode('n1')?.position).toEqual({ x: 40, y: 50 });
        expect(diagnostics.some(d => d.includes('missing parent "ghost"'))).toBe(true);
    });
});
