import { describe, test, expect } from 'vitest';
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { DataType } from '../../types/payload';

describe('Input Node Stability', () => {
    
    test('IN-01 (Constant) should prioritize data.value over cached node.value', async () => {
        const node = {
            id: 'in-01-test',
            type: 'IN-01',
            data: { value: 42 },
            value: PayloadUtils.createScalar(10), // Stale cached value
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        const val = PayloadUtils.unwrap(result);
        
        // Should be 42, not 10
        expect(val).toBe(42);
    });

    test('IN-04 (String) should handle data.value or data.val', async () => {
        const node = {
            id: 'in-04-test',
            type: 'IN-04',
            data: { value: 'Hello World' },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        expect(PayloadUtils.unwrap(result)).toBe('Hello World');

        // Test fallback to 'val'
        const node2 = { ...node, data: { val: 'Fallback' } };
        const result2 = await NodeRegistry.evaluate(node2 as any, {});
        expect(PayloadUtils.unwrap(result2)).toBe('Fallback');
    });

    test('IN-03 (Color) should persist hex from data.value', async () => {
        const node = {
            id: 'in-03-test',
            type: 'IN-03',
            data: { value: '#ff0000' },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        const val = PayloadUtils.unwrap(result) as any;
        expect(val.hex).toBe('ff0000');
        expect(val.vec3).toEqual([1, 0, 0]);
    });

    test('OT-01 (Result) should handle precision without crashing', async () => {
        const node = {
            id: 'ot-01-test',
            type: 'OT-01',
            data: { precision: 2 },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'in': PayloadUtils.createScalar(Math.PI)
        };

        const result = await NodeRegistry.evaluate(node as any, inputs);
        const val = PayloadUtils.unwrap(result);
        expect(val).toBe(3.14);
    });
});
