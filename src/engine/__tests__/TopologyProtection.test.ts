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
                payload: { id: 'e2', source: 'B', sourceHandle: 'out', target: 'A', targetHandle: 'in' }
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
                payload: { id: 'e3', source: 'C', sourceHandle: 'out', target: 'A', targetHandle: 'in' }
            });

            expect(result.success).toBe(false);
            expect(result.reason).toContain('cycle');
        });
    });

    describe('Dynamic Handle Verification (AD-09 Vector Split/Combine)', () => {
        it('should respect handle type swaps when switching AD-09 modes', () => {
            // Add dummy nodes for source/target
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'ExternalSource', type: 'IN-01', position: { x: -100, y: 0 } } });
            brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'ExternalTarget', type: 'MA-01', position: { x: 300, y: 0 } } });

            // AD-09 default op is separate (Separate Vector)
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'AD09', type: 'AD-09', position: { x: 100, y: 0 }, data: { mode: 'separate' } }
            });

            // In separate mode:
            // 'in' should be target (input)
            // 'x', 'y', 'z' should be source (output)
            let validation = brain.validateConnection('ExternalSource', 'out', 'AD09', 'in');
            expect(validation.isValid).toBe(true);

            validation = brain.validateConnection('AD09', 'x', 'ExternalTarget', 'in');
            expect(validation.isValid).toBe(true);

            // Attempting to connect TO 'x' should FAIL because it's a source in separate mode
            validation = brain.validateConnection('ExternalSource', 'out', 'AD09', 'x');
            expect(validation.isValid).toBe(false);

            // --- Switch to COMBINE Mode ---
            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id: 'AD09', data: { mode: 'combine' } }
            });

            // In combine mode:
            // 'x', 'y', 'z' should become target (input)
            // 'out' should become source (output)
            validation = brain.validateConnection('ExternalSource', 'out', 'AD09', 'x');
            expect(validation.isValid).toBe(true);

            // 'in' is no longer a valid handle for AD-09 in combine mode (usually)
            // but let's check if 'out' is now a source
            validation = brain.validateConnection('AD09', 'out', 'ExternalTarget', 'in');
            expect(validation.isValid).toBe(true);

            // Attempting to connect FROM 'x' should FAIL because it's now an input
            validation = brain.validateConnection('AD09', 'x', 'ExternalTarget', 'in');
            expect(validation.isValid).toBe(false);
        });
    });
});
