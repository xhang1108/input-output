import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { TransactionManager } from '@/engine/TransactionManager';
import type { GraphState, Transaction } from '@/engine/types/engineTypes';
import { computeNextState } from '@/hooks/useHistoryExecutor';

function edge(id: string, overrides: Partial<Edge> = {}): Edge {
    return {
        id,
        source: 'source',
        sourceHandle: 'out_a',
        target: 'target',
        targetHandle: 'in_a',
        type: 'magnetic',
        ...overrides,
    };
}

function state(edges: Edge[] = []): GraphState {
    return { nodes: new Map(), edges };
}

const hooks = {
    validateConnection: () => ({ isValid: true }),
};

describe('edge id idempotency', () => {
    it('CONNECT applied twice with the same id yields one edge', () => {
        const manager = new TransactionManager();
        const graph = state();
        const tx: Transaction = { type: 'CONNECT', payload: edge('e1') };

        expect(manager.applyTransaction(tx, graph, hooks).success).toBe(true);
        expect(manager.applyTransaction(tx, graph, hooks).success).toBe(true);

        expect(graph.edges.map(e => e.id)).toEqual(['e1']);
    });

    it('CONNECT with an existing id replaces in place', () => {
        const manager = new TransactionManager();
        const graph = state([edge('e1')]);

        manager.applyTransaction(
            { type: 'CONNECT', payload: edge('e1', { target: 'other', targetHandle: 'in_b' }) },
            graph,
            hooks
        );

        expect(graph.edges).toHaveLength(1);
        expect(graph.edges[0].target).toBe('other');
        expect(graph.edges[0].targetHandle).toBe('in_b');
    });

    it('REORDER_EDGES ignores duplicate ids', () => {
        const manager = new TransactionManager();
        const graph = state([edge('e1'), edge('e2')]);

        manager.applyTransaction(
            { type: 'REORDER_EDGES', payload: ['e2', 'e2', 'e1'] },
            graph,
            hooks
        );

        expect(graph.edges.map(e => e.id)).toEqual(['e2', 'e1']);
    });

    it('REORDER_EDGES self-heals duplicate edges in state', () => {
        const manager = new TransactionManager();
        const graph = state([edge('e1'), edge('e1'), edge('e2')]);

        manager.applyTransaction(
            { type: 'REORDER_EDGES', payload: ['e1', 'e2'] },
            graph,
            hooks
        );

        expect(graph.edges.map(e => e.id)).toEqual(['e1', 'e2']);
    });
});

describe('history edge id idempotency', () => {
    it('re-applying CONNECT for an existing edge id does not duplicate it', () => {
        const result = computeNextState(
            [
                { type: 'CONNECT', payload: edge('e1') },
                { type: 'CONNECT', payload: edge('e1') },
            ],
            [],
            []
        );

        expect(result.nextEdges.map(e => e.id)).toEqual(['e1']);
    });

    it('keeps distinct edges intact', () => {
        const result = computeNextState(
            [
                { type: 'CONNECT', payload: edge('e1') },
                { type: 'CONNECT', payload: edge('e2') },
            ],
            [],
            []
        );

        expect(result.nextEdges.map(e => e.id)).toEqual(['e1', 'e2']);
    });

    it('REORDER_EDGES with duplicate ids does not duplicate edges', () => {
        const result = computeNextState(
            [{ type: 'REORDER_EDGES', payload: ['e1', 'e1', 'e2'] }],
            [],
            [edge('e1'), edge('e2')]
        );

        expect(result.nextEdges.map(e => e.id)).toEqual(['e1', 'e2']);
    });
});
