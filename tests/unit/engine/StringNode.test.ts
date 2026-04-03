import { describe, test, expect } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { PayloadUtils } from '@/utils/PayloadUtils';

describe('String Node (IN-04)', () => {
    
    test('should handle raw string in data.value with type: string', async () => {
        const node = {
            id: 'in-04-test-raw',
            type: 'IN-04',
            data: { type: 'string', value: 'Apple' },
            value: undefined
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        expect(PayloadUtils.unwrap(result)).toBe('Apple');
    });

    test('should handle payload object in data.value (legacy compatibility)', async () => {
        const node = {
            id: 'in-04-test-legacy',
            type: 'IN-04',
            data: { 
                type: 'string',
                value: { type: 'string', value: 'Hello', symbol: null, meta: {} } 
            },
            value: undefined
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        expect(PayloadUtils.unwrap(result)).toBe('Hello');
    });

    test('should fallback to node.value if data is missing', async () => {
        const node = {
            id: 'in-04-test-fallback',
            type: 'IN-04',
            data: { type: 'string' },
            value: PayloadUtils.createString('Cached')
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        expect(PayloadUtils.unwrap(result)).toBe('Cached');
    });
});


