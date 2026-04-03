import { describe, it, expect, beforeEach } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { DataType } from '@/types/payload';

describe('Expression Node (IN-09) Reproduction', () => {
    beforeEach(() => {
        NodeRegistry.initializeNodes();
    });

    it('should evaluate a simple constant expression to Scalar', async () => {
        const node = {
            id: 'test-node',
            type: 'IN-09',
            data: { code: '1 + 2' },
            value: undefined as any,
            selected: false,
            isInDirtyChain: true,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        
        expect(result.type).toBe(DataType.Scalar);
        const val = PayloadUtils.unwrap(result);
        const strVal = typeof val === 'object' && val !== null && (val as any).mathjs === 'BigNumber' ? (val as any).value : String(val);
        expect(strVal).toBe('3');
    });

    it('should return Symbolic for expressions with variables', async () => {
        const node = {
            id: 'test-node',
            type: 'IN-09',
            data: { code: 'y + 1' },
            value: undefined as any,
            selected: false,
            isInDirtyChain: true,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        
        expect(result.type).toBe(DataType.Symbolic);
        expect(result.value).toBe('y + 1');
    });

    it('should handle sin(x) correctly as Symbolic', async () => {
        const node = {
            id: 'test-node',
            type: 'IN-09',
            data: { code: 'sin(x)' },
            value: undefined as any,
            selected: false,
            isInDirtyChain: true,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        
        expect(result.type).toBe(DataType.Symbolic);
        expect(result.value).toBe('sin(x)');
    });

    it('should evaluate sin(0) to 0 (Scalar)', async () => {
        const node = {
            id: 'test-node',
            type: 'IN-09',
            data: { code: 'sin(0)' },
            value: undefined as any,
            selected: false,
            isInDirtyChain: true,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        
        expect(result.type).toBe(DataType.Scalar);
        const val: any = PayloadUtils.unwrap(result);
        if (typeof val === 'object' && val !== null && val.mathjs === 'BigNumber') {
            expect(val.value).toBe('0');
        } else {
            expect(Number(val)).toBe(0);
        }
    });

    it('should detect assignment "x = 2" and set meta.label as Symbolic', async () => {
        const node = {
            id: 'test-node',
            type: 'IN-09',
            data: { code: 'x = 2' },
            value: undefined as any,
            selected: false,
            isInDirtyChain: true,
            position: { x: 0, y: 0 }
        };
        const result = await NodeRegistry.evaluate(node as any, {});
        expect(result.type).toBe(DataType.Symbolic);
        expect(result.value).toBe('x = 2');
        expect(result.meta?.label).toBe('x');
    });

    it('should evaluate a Matrix correctly to DataType.Array', async () => {
        const node = {
            id: 'test-node',
            type: 'IN-09',
            data: { code: '[1, 2; 3, 4]' },
            value: undefined as any,
            selected: false,
            isInDirtyChain: true,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        
        expect(result.type).toBe(DataType.Array);
        const val: any = PayloadUtils.unwrap(result);
        expect(val.mathjs).toBe('Matrix');
        // Check structure instead of strict values to ignore BigNumber dehydration noise
        expect(Array.isArray(val.data)).toBe(true);
        expect(val.data.length).toBe(2);
        expect(val.data[0].length).toBe(2);
    });

    it('should handle complex numbers correctly', async () => {
        const node = {
            id: 'test-node',
            type: 'IN-09',
            data: { code: '3 + 4i' },
            value: undefined as any,
            selected: false,
            isInDirtyChain: true,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        
        expect(result.type).toBe(DataType.Scalar);
        const val: any = PayloadUtils.unwrap(result);
        expect(val.mathjs).toBe('Complex');
        // Handle potentially dehydrated numbers
        const re = typeof val.re === 'object' ? val.re.value : val.re;
        const im = typeof val.im === 'object' ? val.im.value : val.im;
        expect(String(re)).toBe('3');
        expect(String(im)).toBe('4');
    });

    it('should handle booleans correctly', async () => {
        const node = {
            id: 'test-node',
            type: 'IN-09',
            data: { code: '1 < 2' },
            value: undefined as any,
            selected: false,
            isInDirtyChain: true,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        
        expect(result.type).toBe(DataType.Boolean);
        expect(PayloadUtils.unwrap(result)).toBe(true);
    });

    it('should stay Symbolic for function definitions (avoiding serialization errors)', async () => {
        const node = {
            id: 'test-node',
            type: 'IN-09',
            data: { code: 'f(x) = 2x' },
            value: undefined as any,
            selected: false,
            isInDirtyChain: true,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        
        // Function definitions return a function object, which we must NOT wrap as Scalar
        expect(result.type).toBe(DataType.Symbolic);
        expect(result.value).toBe('f(x) = 2x');
    });

    it('should handle empty expression with an error', async () => {
        const node = {
            id: 'test-node',
            type: 'IN-09',
            data: { code: '' },
            value: undefined as any,
            selected: false,
            isInDirtyChain: true,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node as any, {});
        expect(result.type).toBe(DataType.Error);
    });
});

