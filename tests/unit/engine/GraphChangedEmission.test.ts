import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { Brain } from '@/engine/Brain';
import { TransactionManager } from '@/engine/TransactionManager';
import type { GraphState, NodeLogic, Transaction } from '@/engine/types/engineTypes';

/**
 * Emission matrix for `graphChanged` (P1').
 *
 * Contract under test:
 *  - exactly one emission per successful non-silent transaction that needs a topology sync
 *  - zero for silent transactions
 *  - zero for position-only transactions (single MOVE_NODE, or a BATCH whose payload
 *    is all MOVE_NODE / RESIZE_NODE, recursively — this is the drag-commit batch)
 *  - zero for failed transactions
 *  - single RESIZE_NODE keeps emitting (pre-existing user-visible resize sync)
 *
 * `TransactionManager` no longer has an `onGraphChanged` hook at all; Brain owns the
 * single emission. The last describe block guards against a re-introduced hook call.
 */

const SESSION = 'graph-changed-emission';

interface Harness {
    brain: Brain;
    counter: { n: number };
}

async function makeHarness(): Promise<Harness> {
    const brain = Brain.getComputeSession(SESSION);
    await brain.injectNodes(
        {
            nodes: [
                { id: 'A', type: 'IN-01', position: { x: 0, y: 0 }, data: { label: 'A', value: 5 } },
                { id: 'B', type: 'OT-01', position: { x: 120, y: 0 }, data: { label: 'B' } },
            ],
            edges: [],
        },
        true
    );

    // Subscribe after injection so graph setup does not pollute the count.
    const counter = { n: 0 };
    brain.on('graphChanged', () => {
        counter.n += 1;
    });

    return { brain, counter };
}

function move(id: string, x: number, y: number): Transaction {
    return { type: 'MOVE_NODE', payload: { id, position: { x, y }, force: true } };
}

function updateData(id: string, label: string): Transaction {
    return { type: 'UPDATE_NODE_DATA', payload: { id, data: { label } } };
}

describe('graphChanged emission — Brain.applyTransaction', () => {
    it('emits exactly once for a single ADD_NODE', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction({
            type: 'ADD_NODE',
            payload: { id: 'C', type: 'IN-01', position: { x: 0, y: 200 }, data: { label: 'C' } },
        });

        expect(res.success).toBe(true);
        expect(counter.n).toBe(1);
    });

    it('emits exactly once for a single UPDATE_NODE_DATA', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction(updateData('A', 'A2'));

        expect(res.success).toBe(true);
        expect(counter.n).toBe(1);
    });

    it('emits exactly once for a BATCH of two UPDATE_NODE_DATA', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction({
            type: 'BATCH',
            payload: [updateData('A', 'A2'), updateData('B', 'B2')],
        });

        expect(res.success).toBe(true);
        expect(counter.n).toBe(1);
    });

    it('emits once (not twice) for a DISCONNECT of an existing edge', async () => {
        const { brain, counter } = await makeHarness();

        const connect = brain.applyTransaction({
            type: 'CONNECT',
            payload: {
                id: 'e1',
                source: 'A',
                sourceHandle: 'out',
                target: 'B',
                targetHandle: 'in_a',
            },
        });
        expect(connect.success).toBe(true);

        counter.n = 0;
        const res = brain.applyTransaction({ type: 'DISCONNECT', payload: 'e1' });

        expect(res.success).toBe(true);
        expect(counter.n).toBe(1);
        expect(brain.getEdges()).toHaveLength(0);
    });

    it('emits once for REORDER_EDGES', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction({ type: 'REORDER_EDGES', payload: ['x', 'y'] });

        expect(res.success).toBe(true);
        expect(counter.n).toBe(1);
    });

    it('emits zero for a single MOVE_NODE', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction(move('A', 30, 40));

        expect(res.success).toBe(true);
        expect(brain.getNodesMap().get('A')!.position).toEqual({ x: 30, y: 40 });
        expect(counter.n).toBe(0);
    });

    it('emits zero for a drag-commit BATCH of MOVE_NODE only', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction({
            type: 'BATCH',
            payload: [move('A', 31, 41), move('B', 151, 41)],
        });

        expect(res.success).toBe(true);
        expect(counter.n).toBe(0);
    });

    it('emits zero for a BATCH mixing MOVE_NODE and RESIZE_NODE', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction({
            type: 'BATCH',
            payload: [
                move('A', 32, 42),
                { type: 'RESIZE_NODE', payload: { id: 'A', width: 180, height: 90 } },
            ],
        });

        expect(res.success).toBe(true);
        expect(brain.getNodesMap().get('A')!.width).toBe(180);
        expect(counter.n).toBe(0);
    });

    it('emits zero for nested BATCHes that are position-only', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction({
            type: 'BATCH',
            payload: [
                { type: 'BATCH', payload: [move('A', 33, 43)] },
                { type: 'BATCH', payload: [{ type: 'RESIZE_NODE', payload: { id: 'B', width: 200, height: 100 } }] },
            ],
        });

        expect(res.success).toBe(true);
        expect(counter.n).toBe(0);
    });

    it('emits exactly once for a nested BATCH that contains a structural child', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction({
            type: 'BATCH',
            payload: [
                { type: 'BATCH', payload: [move('A', 34, 44)] },
                updateData('B', 'B3'),
            ],
        });

        expect(res.success).toBe(true);
        expect(counter.n).toBe(1);
    });

    it('keeps emitting once for a single RESIZE_NODE (pre-existing resize sync)', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction({
            type: 'RESIZE_NODE',
            payload: { id: 'A', width: 240, height: 120 },
        });

        expect(res.success).toBe(true);
        expect(brain.getNodesMap().get('A')!.width).toBe(240);
        expect(counter.n).toBe(1);
    });

    it('emits zero for a silent UPDATE_NODE_DATA', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction(updateData('A', 'silent'), true);

        expect(res.success).toBe(true);
        expect(brain.getNodesMap().get('A')!.data.label).toBe('silent');
        expect(counter.n).toBe(0);
    });

    it('emits zero for a silent structural BATCH', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction(
            { type: 'BATCH', payload: [updateData('A', 'silent-batch')] },
            true
        );

        expect(res.success).toBe(true);
        expect(counter.n).toBe(0);
    });

    it('emits zero for a failed transaction (unknown node)', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction(updateData('does-not-exist', 'x'));

        expect(res.success).toBe(false);
        expect(counter.n).toBe(0);
    });

    it('emits zero for a failed BATCH (previously emitted through the hook)', async () => {
        const { brain, counter } = await makeHarness();

        const res = brain.applyTransaction({
            type: 'BATCH',
            payload: [move('A', 35, 45), updateData('does-not-exist', 'x')],
        });

        expect(res.success).toBe(false);
        expect(counter.n).toBe(0);
    });
});

// --- TransactionManager level guard -----------------------------------------

function makeLogic(id: string, type: string = 'baseNode'): NodeLogic {
    return {
        id,
        type,
        data: {},
        position: { x: 0, y: 0 },
        selected: false,
        isInDirtyChain: false,
    };
}

function makeState(): GraphState {
    return {
        nodes: new Map([
            ['A', makeLogic('A')],
            ['B', makeLogic('B')],
        ]),
        edges: [],
    };
}

function edge(id: string): Edge {
    return { id, source: 'A', sourceHandle: 'out', target: 'B', targetHandle: 'in_a' };
}

describe('graphChanged emission — TransactionManager never signals the graph', () => {
    it('does not call onGraphChanged for DISCONNECT', () => {
        const manager = new TransactionManager();
        const graph = makeState();
        graph.edges = [edge('e1')];

        let hookCalls = 0;
        const hooks = {
            validateConnection: () => ({ isValid: true }),
            onGraphChanged: () => {
                hookCalls += 1;
            },
        };

        const res = manager.applyTransaction({ type: 'DISCONNECT', payload: 'e1' }, graph, hooks);

        expect(res.success).toBe(true);
        expect(graph.edges).toHaveLength(0);
        expect(hookCalls).toBe(0);
    });

    it('does not call onGraphChanged for a BATCH', () => {
        const manager = new TransactionManager();
        const graph = makeState();

        let hookCalls = 0;
        const hooks = {
            validateConnection: () => ({ isValid: true }),
            onGraphChanged: () => {
                hookCalls += 1;
            },
        };

        const res = manager.applyTransaction(
            {
                type: 'BATCH',
                payload: [{ type: 'UPDATE_NODE_DATA', payload: { id: 'A', data: { label: 'A2' } } }],
            },
            graph,
            hooks
        );

        expect(res.success).toBe(true);
        expect(hookCalls).toBe(0);
    });

    it('does not require onGraphChanged in the hooks contract', () => {
        const manager = new TransactionManager();
        const graph = makeState();

        const res = manager.applyTransaction(
            { type: 'UPDATE_NODE_DATA', payload: { id: 'A', data: { label: 'A3' } } },
            graph,
            { validateConnection: () => ({ isValid: true }) }
        );

        expect(res.success).toBe(true);
    });
});
