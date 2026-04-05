import { describe, test, expect, beforeAll } from 'vitest';
import { NodeRegistry, initializeNodes } from '@/engine/NodeRegistry';
import { DataType } from '@/types/payload';
import { InputOutputEngine } from '@/engine/InputOutputEngine';
import { PayloadUtils } from '@/utils/PayloadUtils';

describe('IN-07 (Array Input) Evaluator', () => {
    beforeAll(() => {
        InputOutputEngine.getInstance();
        initializeNodes();
    });

    test('Should prioritize data.value (New dynamic state)', async () => {
        const node = {
            id: 'n-array',
            type: 'IN-07',
            data: {
                value: [[1, 2], [3, 4]]
            }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        expect(result.type).toBe(DataType.Array);
        // Expecting dehydrated format because evaluator uses PayloadUtils.createArray
        expect((result.value as any).mathjs).toBe('Matrix');
        expect((result.value as any).data).toEqual([[1, 2], [3, 4]]);
    });

    test('Should fallback to data.array (Legacy/Initial state)', async () => {
        const node = {
            id: 'n-array-legacy',
            type: 'IN-07',
            data: {
                array: [[5, 6], [7, 8]]
            }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        expect(result.type).toBe(DataType.Array);
        expect((result.value as any).data).toEqual([[5, 6], [7, 8]]);
    });

    test('Should use node.value as last resort cache', async () => {
        const cachedValue = PayloadUtils.createArray([[9, 0], [0, 9]]);
        const node = {
            id: 'n-array-cache',
            type: 'IN-07',
            data: {},
            value: cachedValue
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        expect(result.type).toBe(DataType.Array);
        expect((result.value as any).data).toEqual([[9, 0], [0, 9]]);
    });

    test('Should return default 3x3 zeros if no data is present', async () => {
        const node = {
            id: 'n-array-default',
            type: 'IN-07',
            data: {}
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        expect(result.type).toBe(DataType.Array);
        expect((result.value as any).data).toEqual([
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ]);
    });
});
