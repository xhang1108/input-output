import { describe, it, beforeEach, expect } from 'vitest';
import { Brain } from '@/engine/Brain';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { registerIONodes } from '@/engine/nodes/ioNodes';
import { registerMathNodes } from '@/engine/nodes/mathNodes';

describe('Switch Node Logic', () => {
    let brain: Brain;

    beforeEach(() => {
        registerIONodes();
        registerMathNodes();
        Brain.disposeAll(); // Prevent heartbeat leaks from previous test runs
        brain = Brain.getInstance();
        brain.clearAll();
    });

    it('should switch between true and false inputs based on condition', async () => {
        // Input Condition (Replacing removed MA-08 Toggle)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'T1',
                type: 'IN-01',
                initialValue: true, // Start TRUE
                position: { x: 0, y: 0 }
            }
        });

        // Input A (True Path)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'N1',
                type: 'IN-01',
                initialValue: 100,
                position: { x: 0, y: 0 }
            }
        });

        // Input B (False Path)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'N2',
                type: 'IN-01',
                initialValue: 200,
                position: { x: 0, y: 0 }
            }
        });

        // Switch (MA-04)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'SW1',
                type: 'LG-02',
                data: {},
                position: { x: 0, y: 0 }
            }
        });

        // 2. Setup Connections
        // T1 -> SW1:condition
        const c1 = brain.applyTransaction({
            type: 'CONNECT',
            payload: {
                id: 'e1',
                source: 'T1',
                sourceHandle: 'out',
                target: 'SW1',
                targetHandle: 'in_a'
            }
        });
        expect(c1.success).toBe(true);

        // N1 -> SW1:in_true
        const c2 = brain.applyTransaction({
            type: 'CONNECT',
            payload: {
                id: 'e2',
                source: 'N1',
                sourceHandle: 'out',
                target: 'SW1',
                targetHandle: 'in_b'
            }
        });
        expect(c2.success).toBe(true);

        // N2 -> SW1:in_false
        const c3 = brain.applyTransaction({
            type: 'CONNECT',
            payload: {
                id: 'e3',
                source: 'N2',
                sourceHandle: 'out',
                target: 'SW1',
                targetHandle: 'in_c'
            }
        });
        expect(c3.success).toBe(true);

        // 3. Verify Initial State (Toggle = True)
        const result1 = await brain.getValue('SW1');
        expect(PayloadUtils.unwrap(result1)).toBe(100);

        // 4. Update Condition to False
        brain.applyTransaction({
            type: 'UPDATE_VALUE',
            payload: {
                id: 'T1',
                value: false
            }
        });

        // Force recalculation (simulate heartbeat or direct call)
        // In test, direct getValue should trigger pull if dirty
        const result2 = await brain.getValue('SW1');
        expect(PayloadUtils.unwrap(result2)).toBe(200);
    });

    it('should reject invalid connections', () => {
        // Test condition target validation
        const res = brain.applyTransaction({
            type: 'CONNECT',
            payload: {
                id: 'e_invalid',
                source: 'N1', // Input Node
                sourceHandle: 'in', // IN-01 'in' doesn't exist
                target: 'SW1',
                targetHandle: 'in_a'
            }
        });
        expect(res.success).toBe(false);
    });
});

