
import { describe, test, expect, beforeAll } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { DataType } from '@/types/payload';
import { InputOutputEngine } from '@/engine/InputOutputEngine';

describe('Matrix Tools (DT-06) Standardization', () => {
    beforeAll(async () => {
        NodeRegistry.initializeNodes();
    });

    test('DT-06: QR Decomposition mapping', async () => {
        const matrix = [[1, 2], [3, 4]];
        const payload = { type: DataType.Array, value: matrix, symbol: null, meta: {} };
        
        const node = { id: 'test', type: 'DT-06', data: { op: 'QR' } };
        const inputs = { in_a: payload };
        
        const result = await NodeRegistry.evaluate(node as any, inputs);
        
        expect(result.type).toBe(DataType.Object);
        expect((result.value as any).out_a).toBeDefined(); // Q
        expect((result.value as any).out_b).toBeDefined(); // R
        expect((result.value as any).Q).toBeUndefined();
    });

    test('DT-06: LUP Decomposition mapping', async () => {
        const matrix = [[1, 2], [3, 4]];
        const payload = { type: DataType.Array, value: matrix, symbol: null, meta: {} };
        
        const node = { id: 'test', type: 'DT-06', data: { op: 'LUP' } };
        const inputs = { in_a: payload };
        
        const result = await NodeRegistry.evaluate(node as any, inputs);
        
        expect(result.type).toBe(DataType.Object);
        expect((result.value as any).out_a).toBeDefined(); // L
        expect((result.value as any).out_b).toBeDefined(); // U
        expect((result.value as any).out_c).toBeDefined(); // P
    });
});

