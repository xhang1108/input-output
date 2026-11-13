import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { appendMissingEdges, reconcileEdgesWithBrain } from '@/utils/edgeUtils';

function edge(id: string, overrides: Partial<Edge> = {}): Edge {
    return {
        id,
        source: 'source',
        sourceHandle: 'out_a',
        target: 'target',
        targetHandle: 'in_a',
        ...overrides,
    };
}

describe('edgeUtils.appendMissingEdges', () => {
    it('returns the same array when there is nothing to add', () => {
        const current = [edge('e1')];

        expect(appendMissingEdges(current, [])).toBe(current);
    });

    it('keeps the same array when every candidate is already present', () => {
        const current = [edge('e1'), edge('e2')];

        expect(appendMissingEdges(current, [edge('e1')])).toBe(current);
    });

    it('appends only missing ids', () => {
        const current = [edge('e1')];
        const result = appendMissingEdges(current, [edge('e1'), edge('e2')]);

        expect(result.map(e => e.id)).toEqual(['e1', 'e2']);
        expect(result).not.toBe(current);
    });

    it('de-duplicates the candidate array itself', () => {
        const result = appendMissingEdges([], [edge('e1'), edge('e1'), edge('e2')]);

        expect(result.map(e => e.id)).toEqual(['e1', 'e2']);
    });

    it('de-duplicates the current array as a self-heal', () => {
        const result = appendMissingEdges(
            [edge('e1'), edge('e1')],
            [edge('e1'), edge('e2'), edge('e2')]
        );
        const ids = result.map(e => e.id);

        expect(ids).toEqual(['e1', 'e2']);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('edgeUtils.reconcileEdgesWithBrain', () => {
    it('drops UI-only ghost edges', () => {
        const ui = [edge('e1'), edge('ghost')];
        const brain = [edge('e1')];

        expect(reconcileEdgesWithBrain(ui, brain).map(e => e.id)).toEqual(['e1']);
    });

    it('keeps Brain order and the UI object for matching ids', () => {
        const uiE1 = edge('e1', { selected: true });
        const uiE2 = edge('e2', { selected: true });
        const brain = [edge('e2'), edge('e1')];

        const result = reconcileEdgesWithBrain([uiE1, uiE2], brain);

        expect(result.map(e => e.id)).toEqual(['e2', 'e1']);
        expect(result[0]).toBe(uiE2);
        expect(result[1]).toBe(uiE1);
    });

    it('adds Brain edges missing from the UI', () => {
        const result = reconcileEdgesWithBrain([edge('e1')], [edge('e1'), edge('e2')]);

        expect(result.map(e => e.id)).toEqual(['e1', 'e2']);
    });
});
