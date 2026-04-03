import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '@/engine/Brain';
import { DataType } from '@/types/payload';
import { registerIONodes } from '@/engine/nodes/ioNodes';
import { registerMathNodes } from '@/engine/nodes/mathNodes';

describe('Result Node Precision', () => {
    let brain: Brain;

    beforeEach(async () => {
        registerIONodes();
        registerMathNodes();
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('should apply precision to the output of a Result node', async () => {
        // 1. Add an input node with a high-precision value
        const val = 1.23456789;
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'IN-1',
                type: 'IN-01',
                position: { x: 0, y: 0 },
                initialValue: val,
                data: {}
            }
        });

        // 2. Add a Result node with precision set to 2
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'OT-1',
                type: 'OT-01', // Result node
                position: { x: 200, y: 0 },
                data: { precision: 2 }
            }
        });

        // 3. Connect them
        brain.applyTransaction({
            type: 'CONNECT',
            payload: {
                id: 'e1',
                source: 'IN-1',
                sourceHandle: 'out',
                target: 'OT-1',
                targetHandle: 'in_a'
            }
        });

        // 4. Trigger evaluation and get value
        const output = await brain.getValue('OT-1');

        // 5. Check the result
        const resultNode = brain.getNodesMap().get('OT-1');

        console.log('Result node output:', JSON.stringify(output, null, 2));

        // If precision works, 1.23456789 with precision 2 should be 1.23
        expect(output).toBeDefined();
        expect(output?.type).toBe(DataType.Scalar);
        expect(output?.value).toBe(1.23);
    });

    it('should apply precision to the output of a Result node (Array)', async () => {
        // 1. Add an input node with an array of high-precision values
        const val = [1.2345, 6.7891];
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'IN-2',
                type: 'IN-01',
                position: { x: 0, y: 0 },
                initialValue: val,
                data: {}
            }
        });

        // 2. Add a Result node with precision set to 2
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'OT-2',
                type: 'OT-01',
                position: { x: 200, y: 0 },
                data: { precision: 2 }
            }
        });

        // 3. Connect them
        brain.applyTransaction({
            type: 'CONNECT',
            payload: {
                id: 'e2',
                source: 'IN-2',
                sourceHandle: 'out',
                target: 'OT-2',
                targetHandle: 'in_a'
            }
        });

        // 4. Trigger evaluation and get value
        const output = await brain.getValue('OT-2');

        console.log('Result node output (Array):', JSON.stringify(output, null, 2));

        // If precision works, [1.2345, 6.7891] with precision 2 should be [1.23, 6.79]
        expect(output).toBeDefined();
        expect(output?.type).toBe(DataType.Array);
        expect(output?.value).toEqual([1.23, 6.79]);
    });
});


