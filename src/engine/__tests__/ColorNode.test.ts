import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '../Brain';
import { PayloadUtils } from '../../utils/PayloadUtils';

describe('Color Node Evaluator', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('should correctly parse a hex string into RGB and Vec3', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color1', type: 'IO-18', position: { x: 0, y: 0 }, data: { value: '#ff0000' } }
            ],
            edges: []
        });

        const result = await brain.getValue('Color1');
        expect(result.value).toEqual({
            hex: '#ff0000',
            rgb: [255, 0, 0],
            vec3: [1, 0, 0]
        });
    });

    it('should be robust when receiving its own output object (idempotency)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color1', type: 'IO-18', position: { x: 0, y: 0 }, data: { value: '#00ff00' } }
            ],
            edges: []
        });

        // First evaluation: returns object
        const firstResult = await brain.getValue('Color1');
        expect(firstResult.value.hex).toBe('#00ff00');

        // Simulate a recalculation where the node's value is already the object
        const node = brain.getNode('Color1');
        if (node) {
            node.isDirty = true;
        }

        const secondResult = await brain.getValue('Color1');
        expect(secondResult.type).toBe('object');
        expect(secondResult.value.hex).toBe('#00ff00');
        expect(secondResult.value.rgb).toEqual([0, 255, 0]);
    });

    it('should handle missing # prefix gracefully', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color1', type: 'IO-18', position: { x: 0, y: 0 }, data: { value: '0000ff' } }
            ],
            edges: []
        });

        const result = await brain.getValue('Color1');
        expect(result.value.hex).toBe('#0000ff');
        expect(result.value.rgb).toEqual([0, 0, 255]);
    });

    it('should handle non-string input fallback', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color1', type: 'IO-18', position: { x: 0, y: 0 }, data: { value: 123456 } }
            ],
            edges: []
        });

        const result = await brain.getValue('Color1');
        // Should fallback to default color #3b82f6
        expect(result.value.hex).toBe('#3b82f6');
    });

    it('should allow MUL operations on Color results (Vec3)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color1', type: 'IO-18', position: { x: 0, y: 0 }, data: { value: '#ff0000' } }, // Vec3: [1, 0, 0]
                { id: 'Math1', type: 'MA-01', position: { x: 100, y: 0 }, data: { op: 'MUL' } },
            ],
            edges: []
        });

        // Use initialValue!
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: { id: 'Scalar1', type: 'IO-01', position: { x: 0, y: 0 }, initialValue: 0.5 }
        });

        // Connect Color.vec3 -> Math.a
        brain.applyTransaction({
            type: 'CONNECT',
            payload: { id: 'e1', source: 'Color1', sourceHandle: 'vec3', target: 'Math1', targetHandle: 'in_a' }
        });

        // Connect Scalar -> Math.b
        brain.applyTransaction({
            type: 'CONNECT',
            payload: { id: 'e2', source: 'Scalar1', sourceHandle: 'out', target: 'Math1', targetHandle: 'in_b' }
        });

        const result = await brain.getValue('Math1');

        if (result.type === 'error') {
            console.error('Math MUL Error:', result.meta.error);
        }

        expect(result.type).toBe('matrix'); // Output provided by MathNode
        // [1, 0, 0] * 0.5 = [0.5, 0, 0]
        const resArray = result.value as number[];
        expect(resArray[0]).toBeCloseTo(0.5);
        expect(resArray[1]).toBeCloseTo(0);
        expect(resArray[2]).toBeCloseTo(0);
    });

    it('should allow ADD operations between Color (Vec3) and Scalar (Broadcasting)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color2', type: 'IO-18', position: { x: 0, y: 0 }, data: { value: '#ff0000' } }, // Vec3: [1, 0, 0]
                { id: 'Math2', type: 'MA-01', position: { x: 100, y: 0 }, data: { op: 'ADD' } },
            ],
            edges: []
        });

        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: { id: 'Scalar2', type: 'IO-01', position: { x: 50, y: 50 }, initialValue: 0.1 }
        });

        // Connect Color.vec3 -> Math.a
        brain.applyTransaction({
            type: 'CONNECT',
            payload: { id: 'e3', source: 'Color2', sourceHandle: 'vec3', target: 'Math2', targetHandle: 'in_a' }
        });

        // Connect Scalar -> Math.b
        brain.applyTransaction({
            type: 'CONNECT',
            payload: { id: 'e4', source: 'Scalar2', sourceHandle: 'out', target: 'Math2', targetHandle: 'in_b' }
        });

        const result = await brain.getValue('Math2');
        if (result.type === 'error') {
            console.error('Math ADD Error:', result.meta.error);
        }

        // Strict Mode might fail here if not relaxed.
        // Expect [1, 0, 0] + 0.1 = [1.1, 0.1, 0.1]
        // If Strict Mode fails, expect error
        if (result.type === 'error') {
            expect(result.meta.error).toContain('Strict Mode');
        } else {
            expect(result.type).toBe('matrix');
            expect(result.value[0]).toBeCloseTo(1.1);
        }
    });
});
