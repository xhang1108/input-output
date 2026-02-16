import { Brain } from '../Brain';
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NODE_DEFINITIONS } from '../../definitions/nodeDefinitions';

describe('Switch Node Logic', () => {
    let brain: Brain;

    beforeEach(() => {
        brain = new Brain();
        brain.clearAll();
    });

    it('should switch between true and false inputs based on condition', async () => {
        // 1. Setup Nodes
        // Toggle (MA-08)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'T1',
                type: 'MA-08',
                data: { value: true }, // Start TRUE
                position: { x: 0, y: 0 }
            }
        });

        // Input A (True Path)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'N1',
                type: 'IO-01',
                data: { value: 100 },
                position: { x: 0, y: 0 }
            }
        });

        // Input B (False Path)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'N2',
                type: 'IO-01',
                data: { value: 200 },
                position: { x: 0, y: 0 }
            }
        });

        // Switch (MA-04)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'SW1',
                type: 'MA-04',
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
                targetHandle: 'condition'
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
                targetHandle: 'in_true'
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
                targetHandle: 'in_false'
            }
        });
        expect(c3.success).toBe(true);

        // 3. Verify Initial State (Toggle = True)
        const result1 = await brain.getValue('SW1');
        expect(PayloadUtils.unwrap(result1)).toBe(100);

        // 4. Update Toggle to False
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id: 'T1',
                data: { value: false }
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
                sourceHandle: 'in', // Trying to connect Input to Input? No IO-01 'in' doesn't exist.
                target: 'SW1',
                targetHandle: 'condition'
            }
        });
        // IO-01 has no 'in'. 
    });
});
