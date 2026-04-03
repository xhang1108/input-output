import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Brain } from '@/engine/Brain';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { InputOutputEngine } from '@/engine/InputOutputEngine';

describe('Engine Durability (Pulse & Routing)', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    afterEach(() => {
        brain.dispose();
    });

    describe('Stepwise Propagation (Performance Protection)', () => {
        it('should NOT dirty downstream nodes (C) when B re-computes to the same value', async () => {
            const math = InputOutputEngine.getInstance().getMathInstance();

            // Setup: A -> B (ABS) -> C
            // We use math.bignumber to ensure high precision consistency
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'A', type: 'IN-01' } });
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'B', type: 'MA-01', data: { op: 'ABS' } } });
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'C', type: 'MA-01' } });
            brain.applyTransaction({ type: 'CONNECT', payload: { id: 'e1', source: 'A', sourceHandle: 'out', target: 'B', targetHandle: 'in_a' } });
            brain.applyTransaction({ type: 'CONNECT', payload: { id: 'e2', source: 'B', sourceHandle: 'out', target: 'C', targetHandle: 'in_a' } });

            // 1. Initial State: A = -5 -> B = 5 -> C = 5
            brain.applyTransaction({ type: 'UPDATE_VALUE', payload: { id: 'A', value: math.bignumber(-5) } });
            await (brain as any).recalculateDirtyChain();

            expect(brain.getNode('B')?.isInDirtyChain).toBe(false);
            expect(brain.getNode('C')?.isInDirtyChain).toBe(false);

            // 2. Change A to 5. abs(5) = 5.
            // B will be dirty because A changed.
            // But C should STAY CLEAN because B's result value (5) is identical to its previous value (5).
            brain.applyTransaction({ type: 'UPDATE_VALUE', payload: { id: 'A', value: math.bignumber(5) } });
            
            expect(brain.getNode('A')?.isInDirtyChain).toBe(true);
            expect(brain.getNode('B')?.isInDirtyChain).toBe(true);
            expect(brain.getNode('C')?.isInDirtyChain).toBe(false);

            // 3. Recalculate
            await (brain as any).recalculateDirtyChain();

            // After recalc, B is clean, and C MUST remain clean (Stepwise Propagation holding firm)
            expect(brain.getNode('B')?.isInDirtyChain).toBe(false);
            expect(brain.getNode('C')?.isInDirtyChain).toBe(false);
        });
    });

    describe('Multi-Output Data Routing', () => {
        it('should correctly route x and y components from AD-09', async () => {
            const math = InputOutputEngine.getInstance().getMathInstance();
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'AD09', type: 'AD-09', data: { mode: 'separate' } } });
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'B', type: 'MA-01' } });
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'C', type: 'MA-01' } });
            brain.applyTransaction({ type: 'CONNECT', payload: { id: 'ex', source: 'AD09', sourceHandle: 'x', target: 'B', targetHandle: 'in_a' } });
            brain.applyTransaction({ type: 'CONNECT', payload: { id: 'ey', source: 'AD09', sourceHandle: 'y', target: 'C', targetHandle: 'in_a' } });

            brain.applyTransaction({ type: 'UPDATE_VALUE', payload: { id: 'AD09', value: { x: 123, y: 456, z: 0 } } });
            await (brain as any).recalculateDirtyChain();

            const valB = brain.peekValue('B');
            const valC = brain.peekValue('C');

            const hydB = PayloadUtils.hydrate(PayloadUtils.unwrap(valB) as any, math);
            const hydC = PayloadUtils.hydrate(PayloadUtils.unwrap(valC) as any, math);

            expect(Number(hydB)).toBe(123);
            expect(Number(hydC)).toBe(456);
        });
    });
});

