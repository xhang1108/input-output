
import { describe, test, expect, beforeAll } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { DataType } from '@/types/payload';
import { PayloadUtils } from '@/utils/PayloadUtils';

describe('Array Calculus (DT-06) Standardization', () => {
    beforeAll(async () => {
        NodeRegistry.initializeNodes();
    });

    test('DT-06: QR Decomposition mapping', async () => {
        const data = [[1, 2], [3, 4]];
        const payload = PayloadUtils.createArray(data);
        
        const node = { id: 'test', type: 'DT-06', data: { op: 'QR' } };
        const inputs = { in_a: payload };
        
        const result = await NodeRegistry.evaluate(node as any, inputs) as any;
        
        expect(result.type).toBe(DataType.Object);
        expect(result.value.out_a).toBeDefined(); // Q
        expect(result.value.out_b).toBeDefined(); // R
        expect(result.value.Q).toBeUndefined();
    });

    test('DT-06: LUP Decomposition mapping', async () => {
        const data = [[1, 2], [3, 4]];
        const payload = PayloadUtils.createArray(data);
        
        const node = { id: 'test', type: 'DT-06', data: { op: 'LUP' } };
        const inputs = { in_a: payload };
        
        const result = await NodeRegistry.evaluate(node as any, inputs) as any;
        
        expect(result.type).toBe(DataType.Object);
        expect(result.value.out_a).toBeDefined(); // L
        expect(result.value.out_b).toBeDefined(); // U
        expect(result.value.out_c).toBeDefined(); // P
    });
});
