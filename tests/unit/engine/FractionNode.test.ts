import { describe, test, expect, beforeAll } from 'vitest';
import { NodeRegistry, initializeNodes } from '@/engine/NodeRegistry';
import { DataType } from '@/types/payload';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { InputOutputEngine } from '@/engine/InputOutputEngine';

describe('Fraction Node (MA-12) & Rounding Node (MA-14)', () => {

    test('MA-12: Should convert decimal to fraction', async () => {
        const node = {
            id: 'test-fraction',
            type: 'MA-06',
            data: {},
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: PayloadUtils.createScalar(0.5)
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(result.type).toBe(DataType.Object);
        expect(val.out_b.value).toBe(1);   // numerator
        expect(val.out_c.value).toBe(2);   // denominator
        expect(val.out_d.value).toBe('1/2'); // string
    });

    test('MA-12: Should handle repeating decimals', async () => {
        const node = {
            id: 'test-fraction-repeat',
            type: 'MA-06',
            data: {},
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: PayloadUtils.createScalar(1 / 3) // 0.333...
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(val.out_b.value).toBe(1);   // numerator
        expect(val.out_c.value).toBe(3);   // denominator
        expect(val.out_d.value).toBe('1/3'); // string
    });

    test('MA-12: Should handle strings', async () => {
        const node = {
            id: 'test-fraction-str',
            type: 'MA-06',
            data: {},
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        // Note: IN-04 outputs DataType.String now
        const inputs = {
            in_a: PayloadUtils.createString('2.5')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(val.out_b.value).toBe(5);   // numerator
        expect(val.out_c.value).toBe(2);   // denominator
        expect(val.out_d.value).toBe('5/2'); // string
    });

    test('MA-14: Should perform rounding (Regression)', async () => {
        const node = {
            id: 'test-round',
            type: 'MA-05',
            data: { precision: 2 },
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: PayloadUtils.createScalar(3.14159)
        };

        const result = await NodeRegistry.evaluate(node, inputs);

        expect(result.type).toBe(DataType.Scalar);
        expect(result.value).toBe(3.14);
    });

    test('MA-12: Should handle mixed fractions', async () => {
        const node = {
            id: 'test-mixed',
            type: 'MA-06',
            data: { mixed: true },
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            // 2.5 = 2 1/2
            in_a: PayloadUtils.createScalar(2.5)
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(val.out_a.value).toBe(2);   // int
        expect(val.out_b.value).toBe(1);   // numerator
        expect(val.out_c.value).toBe(2);   // denominator
        expect(val.out_d.value).toBe('2 1/2'); // string
    });

    test('MA-12: Should handle mixed fractions with integer result', async () => {
        const node = {
            id: 'test-mixed-int',
            type: 'MA-06',
            data: { mixed: true },
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: PayloadUtils.createScalar(3)
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(val.out_a.value).toBe(3);   // int
        expect(val.out_b.value).toBe(0);   // numerator
        expect(val.out_c.value).toBe(1);   // denominator
        expect(val.out_d.value).toBe('3'); // string
    });
    
    test('MA-12: Should handle dehydrated BigNumber from Division (Regression)', async () => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        
        // Simulate MA-01 (Division 1/3)
        const divResult = math.divide(math.bignumber(1), math.bignumber(3));
        const divPayload = PayloadUtils.wrap(divResult); // Dehydrates to { mathjs: 'BigNumber', value: '...' }
        
        const node = {
            id: 'test-fraction-div',
            type: 'MA-06',
            data: {},
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: divPayload
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(result.type).toBe(DataType.Object);
        expect(val.out_b.value).toBe(1);   // numerator
        expect(val.out_c.value).toBe(3);   // denominator
        expect(val.out_d.value).toBe('1/3'); // string
    });

    test('MA-08: Should handle dehydrated BigNumber inputs (Combinatorics Regression)', async () => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        
        const nPayload = PayloadUtils.wrap(math.bignumber(10));
        const rPayload = PayloadUtils.wrap(math.bignumber(3));
        
        const node = {
            id: 'test-comb',
            type: 'MA-08',
            data: { op: 'nCr' },
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: nPayload,
            in_b: rPayload
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        expect(result.type).toBe(DataType.Scalar);
        
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(result), math);
        expect(Number(hydrated)).toBe(120);
    });
});

