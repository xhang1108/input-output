// @vitest-environment node

/**
 * UI/Brain parity for history restores.
 * - MOVE_NODE: the Brain has a sub-pixel deadzone, so restores must force it.
 * - RESIZE_NODE: values <= 10 keep the node's current size.
 * - UPDATE_NODE_DATA sizes: the Brain rounds and floors them at 10px.
 */
import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { TransactionManager } from '@/engine/TransactionManager';
import type { GraphState, NodeLogic, Transaction } from '@/engine/types/engineTypes';
import { computeNextState, withForcedMoves } from '@/hooks/useHistoryExecutor';

const hooks = {
    validateConnection: () => ({ isValid: true }),
};

const makeLogic = (overrides: Partial<NodeLogic> = {}): NodeLogic => ({
    id: 'a',
    type: 'mathNode',
    position: { x: 100, y: 100 },
    data: { label: 'A' },
    selected: false,
    isInDirtyChain: false,
    ...overrides,
} as unknown as NodeLogic);

const graphWith = (node: NodeLogic): GraphState => ({
    nodes: new Map([[node.id, node]]),
    edges: [],
});

const moveTx = (position: { x: number; y: number }, force?: boolean): Transaction => ({
    type: 'MOVE_NODE',
    payload: force === undefined
        ? { id: 'a', position }
        : { id: 'a', position, force },
});

const uiNode = (overrides: Record<string, unknown> = {}): Node => ({
    id: 'a',
    type: 'mathNode',
    position: { x: 100, y: 100 },
    data: { label: 'A' },
    ...overrides,
} as unknown as Node);

describe('withForcedMoves', () => {
    it('forces nested MOVE_NODE inside BATCH payloads', () => {
        const tx: Transaction = {
            type: 'BATCH',
            payload: [
                { type: 'MOVE_NODE', payload: { id: 'a', position: { x: 1, y: 2 } } },
                {
                    type: 'BATCH',
                    payload: [
                        { type: 'MOVE_NODE', payload: { id: 'b', position: { x: 3, y: 4 } } },
                    ],
                },
                { type: 'REMOVE_NODE', payload: 'c' },
            ],
        };

        const [batch] = withForcedMoves([tx]);
        const inner = batch.payload as Transaction[];
        const nested = inner[1].payload as Transaction[];

        expect((inner[0].payload as { force?: boolean }).force).toBe(true);
        expect((nested[0].payload as { force?: boolean }).force).toBe(true);
    });

    it('keeps non-move transactions by reference', () => {
        const remove: Transaction = { type: 'REMOVE_NODE', payload: 'c' };
        const value: Transaction = { type: 'UPDATE_VALUE', payload: { id: 'a', value: 1 } };

        const result = withForcedMoves([remove, value]);

        expect(result[0]).toBe(remove);
        expect(result[1]).toBe(value);
    });

    it('does not mutate the input array or its transactions', () => {
        const move: Transaction = {
            type: 'MOVE_NODE',
            payload: { id: 'a', position: { x: 1, y: 2 } },
        };
        const input: Transaction[] = [move];
        const snapshot = JSON.parse(JSON.stringify(input));

        const result = withForcedMoves(input);

        expect(input).toEqual(snapshot);
        expect(input[0]).toBe(move);
        expect(result[0]).not.toBe(move);
        expect(result[0].payload).not.toBe(move.payload);
        expect((result[0].payload as { force?: boolean }).force).toBe(true);
    });

    it('keeps the recorded payload shape plus an enumerable force flag', () => {
        const move: Transaction = {
            type: 'MOVE_NODE',
            payload: { id: 'a', position: { x: 1, y: 2 } },
        };

        const [forced] = withForcedMoves([move]);

        expect(forced).toEqual({
            type: 'MOVE_NODE',
            payload: { id: 'a', position: { x: 1, y: 2 }, force: true },
        });
        expect((forced.payload as { force?: boolean }).force).toBe(true);
    });
});

describe('TransactionManager MOVE_NODE deadzone', () => {
    it('ignores a 0.2px move without force', () => {
        const manager = new TransactionManager();
        const node = makeLogic();
        const graph = graphWith(node);

        const res = manager.applyTransaction(moveTx({ x: 100.2, y: 100 }), graph, hooks);

        expect(res.success).toBe(true);
        expect(node.position).toEqual({ x: 100, y: 100 });
    });

    it('applies the same 0.2px move when forced', () => {
        const manager = new TransactionManager();
        const node = makeLogic();
        const graph = graphWith(node);

        const res = manager.applyTransaction(moveTx({ x: 100.2, y: 100 }, true), graph, hooks);

        expect(res.success).toBe(true);
        expect(node.position).toEqual({ x: 100.2, y: 100 });
    });
});

describe('computeNextState size parity', () => {
    it('keeps the current size for a RESIZE_NODE below the Brain threshold', () => {
        const { nextNodes } = computeNextState(
            [{ type: 'RESIZE_NODE', payload: { id: 'a', width: 8, height: 8 } }],
            [uiNode({ width: 150, height: 50, data: { label: 'A', width: 150, height: 50 } })],
            []
        );

        // TransactionManager falls back to node.width || 150 and node.height || 50,
        // it does not clamp a sub-threshold resize to 10.
        expect(nextNodes[0].width).toBe(150);
        expect(nextNodes[0].height).toBe(50);
        expect(nextNodes[0].data.width).toBe(150);
        expect(nextNodes[0].data.height).toBe(50);
        expect(nextNodes[0].style?.width).toBe(150);
        expect(nextNodes[0].style?.height).toBe(50);
    });

    it('uses the 150x50 default when a sub-threshold resize has no current size', () => {
        const { nextNodes } = computeNextState(
            [{ type: 'RESIZE_NODE', payload: { id: 'a', width: 0, height: 0 } }],
            [uiNode()],
            []
        );

        expect(nextNodes[0].width).toBe(150);
        expect(nextNodes[0].height).toBe(50);
    });

    it('rounds RESIZE_NODE sizes', () => {
        const { nextNodes } = computeNextState(
            [{ type: 'RESIZE_NODE', payload: { id: 'a', width: 120.4, height: 60.6 } }],
            [uiNode()],
            []
        );

        expect(nextNodes[0].width).toBe(120);
        expect(nextNodes[0].height).toBe(61);
        expect(nextNodes[0].data.width).toBe(120);
    });

    it('rounds and clamps UPDATE_NODE_DATA sizes', () => {
        const { nextNodes } = computeNextState(
            [{ type: 'UPDATE_NODE_DATA', payload: { id: 'a', data: { width: 8.4, height: 99.5 } } }],
            [uiNode()],
            []
        );

        expect(nextNodes[0].width).toBe(10);
        expect(nextNodes[0].height).toBe(100);
        expect(nextNodes[0].data.width).toBe(10);
        expect(nextNodes[0].data.height).toBe(100);
    });

    it('does not clamp a non-finite data.width', () => {
        const { nextNodes } = computeNextState(
            [{ type: 'UPDATE_NODE_DATA', payload: { id: 'a', data: { width: 'auto' } } }],
            [uiNode()],
            []
        );

        expect(nextNodes[0].data.width).toBe('auto');
    });

    it('applies MOVE_NODE exactly (no UI deadzone)', () => {
        const { nextNodes } = computeNextState([moveTx({ x: 100.2, y: 100 })], [uiNode()], []);

        expect(nextNodes[0].position).toEqual({ x: 100.2, y: 100 });
    });

    it('maps UPDATE_VALUE into data.value without leaking id into data', () => {
        const { nextNodes } = computeNextState(
            [{ type: 'UPDATE_VALUE', payload: { id: 'a', value: 42 } }],
            [uiNode({ data: { label: 'A', value: 1 } })],
            []
        );

        expect(nextNodes[0].data.value).toBe(42);
        expect((nextNodes[0].data as Record<string, unknown>).id).toBeUndefined();
    });
});
