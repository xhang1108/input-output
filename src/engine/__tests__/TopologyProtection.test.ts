import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Brain } from '../Brain';

describe('Topology Protection & Durable Safety', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        // Reset brain state
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    afterEach(() => {
        brain.dispose();
    });

    describe('Circular Dependency Guard', () => {
        it('should reject a direct cycle (A -> B -> A)', async () => {
            // 1. Add two nodes
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'A', type: 'IN-01', position: { x: 0, y: 0 } }
            });
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'B', type: 'MA-01', position: { x: 200, y: 0 } }
            });

            // 2. Connect A -> B
            const connectAB = brain.applyTransaction({
                type: 'CONNECT',
                payload: { id: 'e1', source: 'A', sourceHandle: 'out', target: 'B', targetHandle: 'in_a' }
            });
            expect(connectAB.success).toBe(true);

            // 3. Try to connect B -> A (Illegal Cycle)
            const connectBA = brain.applyTransaction({
                type: 'CONNECT',
                payload: { id: 'e2', source: 'B', sourceHandle: 'out', target: 'A', targetHandle: 'in_a' }
            });

            expect(connectBA.success).toBe(false);
            expect(connectBA.reason).toContain('cycle');
        });

        it('should reject a multi-step cycle (A -> B -> C -> A)', async () => {
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'A', type: 'IN-01', position: { x: 0, y: 0 } } });
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'B', type: 'MA-01', position: { x: 200, y: 0 } } });
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'C', type: 'MA-01', position: { x: 400, y: 0 } } });

            // A -> B
            brain.applyTransaction({ type: 'CONNECT', payload: { id: 'e1', source: 'A', sourceHandle: 'out', target: 'B', targetHandle: 'in_a' } });
            // B -> C
            brain.applyTransaction({ type: 'CONNECT', payload: { id: 'e2', source: 'B', sourceHandle: 'out', target: 'C', targetHandle: 'in_a' } });

            // C -> A (Illegal)
            const result = brain.applyTransaction({
                type: 'CONNECT',
                payload: { id: 'e3', source: 'C', sourceHandle: 'out', target: 'A', targetHandle: 'in_a' }
            });

            expect(result.success).toBe(false);
            expect(result.reason).toContain('cycle');
        });
    });


});
