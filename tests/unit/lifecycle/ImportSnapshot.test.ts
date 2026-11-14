// @vitest-environment node

/**
 * One-shot pre-import safety net. Not undo history: capture holds the graph
 * that a replace import is about to overwrite, so the success toast can restore
 * it after the history stack was dropped.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import {
    captureImportSnapshot,
    clearImportSnapshot,
    getImportSnapshot,
} from '@/utils/importSnapshot';

const node = (id: string): Node => ({
    id,
    type: 'io:val',
    position: { x: 0, y: 0 },
    data: { label: id },
});

const edge = (id: string, source = 'a', target = 'b'): Edge => ({
    id,
    source,
    sourceHandle: 'out',
    target,
    targetHandle: 'in',
});

describe('importSnapshot', () => {
    afterEach(() => {
        clearImportSnapshot();
    });

    it('has no snapshot before the first capture', () => {
        expect(getImportSnapshot()).toBeNull();
    });

    it('returns the captured nodes and edges', () => {
        const nodes = [node('a'), node('b')];
        const edges = [edge('e1')];

        captureImportSnapshot(nodes, edges);

        const snapshot = getImportSnapshot();
        expect(snapshot).not.toBeNull();
        expect(snapshot!.nodes).toEqual(nodes);
        expect(snapshot!.edges).toEqual(edges);
    });

    it('stores the captured references instead of a deep copy', () => {
        const nodes = [node('a')];
        const edges = [edge('e1')];

        captureImportSnapshot(nodes, edges);

        const snapshot = getImportSnapshot();
        expect(snapshot!.nodes).toBe(nodes);
        expect(snapshot!.edges).toBe(edges);
    });

    it('keeps returning the snapshot until it is cleared', () => {
        captureImportSnapshot([node('a')], []);

        expect(getImportSnapshot()).not.toBeNull();
        expect(getImportSnapshot()).not.toBeNull();
    });

    it('replaces the previous snapshot on a second capture', () => {
        captureImportSnapshot([node('old')], [edge('old-edge')]);
        const secondNodes = [node('new')];
        const secondEdges = [edge('new-edge')];

        captureImportSnapshot(secondNodes, secondEdges);

        const snapshot = getImportSnapshot();
        expect(snapshot!.nodes).toBe(secondNodes);
        expect(snapshot!.edges).toBe(secondEdges);
        expect(snapshot!.nodes.map(n => n.id)).toEqual(['new']);
    });

    it('clears the snapshot and is safe to clear twice', () => {
        captureImportSnapshot([node('a')], [edge('e1')]);

        clearImportSnapshot();
        expect(getImportSnapshot()).toBeNull();

        clearImportSnapshot();
        expect(getImportSnapshot()).toBeNull();
    });

    it('fills width/height from measured without mutating the live node', () => {
        const live = { ...node('a'), measured: { width: 240, height: 120 } } as Node;

        captureImportSnapshot([live], []);

        const captured = getImportSnapshot()!.nodes[0];
        expect(captured.width).toBe(240);
        expect(captured.height).toBe(120);
        expect(captured.measured).toEqual({ width: 240, height: 120 });
        expect(captured.data).toEqual(live.data);
        expect(live.width).toBeUndefined();
        expect(live.height).toBeUndefined();
        expect(captured).not.toBe(live);
    });

    it('prefers explicit width/height over measured', () => {
        const live = {
            ...node('a'),
            width: 300,
            height: 150,
            measured: { width: 240, height: 120 },
        } as Node;

        captureImportSnapshot([live], []);

        const captured = getImportSnapshot()!.nodes[0];
        expect(captured.width).toBe(300);
        expect(captured.height).toBe(150);
        expect(captured).toBe(live);
    });
});
