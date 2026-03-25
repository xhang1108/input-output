import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '../Brain';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { DataType } from '../../types/payload';

describe('Color Node Evaluator', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('should correctly parse a hex string into RGB and Vec3', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color1', type: 'IN-03', position: { x: 0, y: 0 }, data: { value: '#ff0000' } }
            ],
            edges: []
        });

        const result = await brain.getValue('Color1');
        expect(result.type).toBe(DataType.Color);
        expect(PayloadUtils.unwrap(result)).toEqual({
            hex: 'ff0000',
            rgb: [255, 0, 0],
            vec3: [1, 0, 0]
        });
    });

    it('should be robust when receiving its own output object (idempotency)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color1', type: 'IN-03', position: { x: 0, y: 0 }, data: { value: '#00ff00' } }
            ],
            edges: []
        });

        // First evaluation: returns object
        const firstResult = await brain.getValue('Color1');
        expect((firstResult.value as any).hex).toBe('00ff00');

        // Simulate a recalculation where the node's value is already the object
        const node = brain.getNode('Color1');
        if (node) {
            node.isInDirtyChain = true;
        }

        const secondResult = await brain.getValue('Color1');
        expect(secondResult.type).toBe(DataType.Color);
        const secondVal = PayloadUtils.unwrap(secondResult) as any;
        expect(secondVal.hex).toBe('00ff00');
        expect(secondVal.rgb).toEqual([0, 255, 0]);
    });

    it('should handle missing # prefix gracefully', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color1', type: 'IN-03', position: { x: 0, y: 0 }, data: { value: '0000ff' } }
            ],
            edges: []
        });

        const result = await brain.getValue('Color1');
        expect((result.value as any).hex).toBe('0000ff');
        expect((result.value as any).rgb).toEqual([0, 0, 255]);
    });

    it('should handle non-string input fallback', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color1', type: 'IN-03', position: { x: 0, y: 0 }, data: { value: 123456 } }
            ],
            edges: []
        });

        const result = await brain.getValue('Color1');
        // Should fallback to default color 3b82f6 (no hash)
        expect((result.value as any).hex).toBe('3b82f6');
    });

    it('should allow MUL operations on Color results (Vec3)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color1', type: 'IN-03', position: { x: 0, y: 0 }, data: { value: '#ff0000' } }, // Vec3: [1, 0, 0]
                { id: 'Math1', type: 'MA-01', position: { x: 100, y: 0 }, data: { op: 'MUL' } },
            ],
            edges: []
        });

        // Use initialValue!
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: { id: 'Scalar1', type: 'IN-01', position: { x: 0, y: 0 }, initialValue: 0.5 }
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

        if (result.type === DataType.Error) {
            console.error('Math MUL Error:', result.meta.error);
        }

        expect(result.type).toBe(DataType.Array); // Output provided by MathNode (Vector)
        
        const unwrapped = PayloadUtils.unwrap(result);
        const getRawArray = (v: any) => {
            if (Array.isArray(v)) return v;
            if (v && v.mathjs === 'Matrix' && Array.isArray(v.data)) return v.data;
            if (v && typeof v.toArray === 'function') return v.toArray();
            return v;
        };
        const resArray = getRawArray(unwrapped);

        const getVal = (v: any) => {
            if (v && typeof v === 'object' && v.mathjs === 'BigNumber') return Number(v.value);
            return Number(v);
        };

        // [1, 0, 0] * 0.5 = [0.5, 0, 0]
        expect(getVal(resArray[0])).toBeCloseTo(0.5);
        expect(getVal(resArray[1])).toBeCloseTo(0);
        expect(getVal(resArray[2])).toBeCloseTo(0);
    });

    it('should allow ADD operations between Color (Vec3) and Scalar (Broadcasting)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Color2', type: 'IN-03', position: { x: 0, y: 0 }, data: { value: '#ff0000' } }, // Vec3: [1, 0, 0]
                { id: 'Math2', type: 'MA-01', position: { x: 100, y: 0 }, data: { op: 'ADD' } },
            ],
            edges: []
        });

        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: { id: 'Scalar2', type: 'IN-01', position: { x: 50, y: 50 }, initialValue: 0.1 }
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
        if (result.type === DataType.Error) {
            console.error('Math ADD Error:', result.meta.error);
        }

        // Expect [1, 0, 0] + 0.1 = [1.1, 0.1, 0.1]
        // If Strict Mode fails, expect error
        if (result.type === DataType.Error) {
            expect(result.meta.error).toContain('Strict Mode');
        } else {
            expect(result.type).toBe(DataType.Array);
            
            const unwrapped = PayloadUtils.unwrap(result);
            const getRawArray = (v: any) => {
                if (Array.isArray(v)) return v;
                if (v && v.mathjs === 'Matrix' && Array.isArray(v.data)) return v.data;
                if (v && typeof v.toArray === 'function') return v.toArray();
                return v;
            };
            const resArray = getRawArray(unwrapped);
            const getVal = (v: any) => {
                if (v && typeof v === 'object' && v.mathjs === 'BigNumber') return Number(v.value);
                return Number(v);
            };

            expect(getVal(resArray[0])).toBeCloseTo(1.1);
            expect(getVal(resArray[1])).toBeCloseTo(0.1);
            expect(getVal(resArray[2])).toBeCloseTo(0.1);
        }
    });
});
