import { describe, test, expect } from 'vitest';
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';

describe('Constant Node Precision (IN-06)', () => {
    
    test('should round pi to 2 decimal places', async () => {
        const node = {
            id: 'in-06-test',
            type: 'IN-06',
            data: { val: 'pi', precision: 2 },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        const val = PayloadUtils.unwrap(result) as any;
        const num = typeof val === 'object' && val !== null ? Number(val.value) : Number(val);
        
        expect(num).toBe(3.14);
    });

    test('should handle high precision (-1) without crashing', async () => {
        const node = {
            id: 'in-06-test-high',
            type: 'IN-06',
            data: { val: 'pi', precision: -1 },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        const val = PayloadUtils.unwrap(result) as any;
        const num = typeof val === 'object' && val !== null ? Number(val.value) : Number(val);
        
        expect(num).toBeGreaterThan(3.1415);
    });

    test('should support 0 decimal places precisely', async () => {
        const node = {
            id: 'in-06-test-zero',
            type: 'IN-06',
            data: { val: 'pi', precision: 0 },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        const val = PayloadUtils.unwrap(result) as any;
        const num = typeof val === 'object' && val !== null ? Number(val.value) : Number(val);
        
        expect(num).toBe(3);
    });

    test('should work correctly for Euler number (e)', async () => {
        const node = {
            id: 'in-06-test-e',
            type: 'IN-06',
            data: { val: 'e', precision: 4 },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        const val = PayloadUtils.unwrap(result) as any;
        const num = typeof val === 'object' && val !== null ? Number(val.value) : Number(val);
        
        expect(num).toBe(2.7183);
    });
});
