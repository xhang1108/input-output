import { describe, test, expect, beforeAll } from 'vitest';
import { NodeRegistry, initializeNodes } from '../NodeRegistry';
import { DataType } from '../../types/payload';

beforeAll(() => {
    initializeNodes();
});

describe('String Node (IO-04)', () => {
    test('Should output a string payload', async () => {
        const node = {
            id: 'test-string',
            type: 'IO-04',
            data: { value: 'Hello World' },
            value: { type: DataType.String, value: '', symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node, {});

        expect(result.type).toBe(DataType.String);
        expect(result.value).toBe('Hello World');
    });

    test('Should handle empty string', async () => {
        const node = {
            id: 'test-string-empty',
            type: 'IO-04',
            data: { value: '' },
            value: { type: DataType.String, value: '', symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node, {});

        expect(result.type).toBe(DataType.String);
        expect(result.value).toBe('');
    });

    test('Should stringify numbers', async () => {
        const node = {
            id: 'test-string-num',
            type: 'IO-04',
            data: { value: 123 },
            value: { type: DataType.String, value: '', symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node, {});

        expect(result.type).toBe(DataType.String);
        expect(result.value).toBe('123');
    });
});
