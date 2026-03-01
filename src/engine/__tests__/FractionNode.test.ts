import { describe, test, expect, beforeAll } from 'vitest';
import { NodeRegistry, initializeNodes } from '../NodeRegistry';
import { DataType } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { InputOutputEngine } from '../InputOutputEngine';

describe('Fraction Node (MA-12) & Rounding Node (MA-14)', () => {
    beforeAll(() => {
        InputOutputEngine.getInstance();
        initializeNodes();
    });

    test('MA-12: Should convert decimal to fraction', async () => {
        const node = {
            id: 'test-fraction',
            type: 'MA-12',
            data: {},
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in: PayloadUtils.createScalar(0.5)
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(result.type).toBe(DataType.Object);
        expect(val.numerator.value).toBe(1);
        expect(val.denominator.value).toBe(2);
        expect(val.string.value).toBe('1/2');
    });

    test('MA-12: Should handle repeating decimals', async () => {
        const node = {
            id: 'test-fraction-repeat',
            type: 'MA-12',
            data: {},
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in: PayloadUtils.createScalar(1 / 3) // 0.333...
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(val.numerator.value).toBe(1);
        expect(val.denominator.value).toBe(3);
        expect(val.string.value).toBe('1/3');
    });

    test('MA-12: Should handle strings', async () => {
        const node = {
            id: 'test-fraction-str',
            type: 'MA-12',
            data: {},
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        // Note: IO-04 outputs DataType.String now
        const inputs = {
            in: PayloadUtils.createString('2.5')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(val.numerator.value).toBe(5);
        expect(val.denominator.value).toBe(2);
        expect(val.string.value).toBe('5/2');
    });

    test('MA-14: Should perform rounding (Regression)', async () => {
        const node = {
            id: 'test-round',
            type: 'MA-14',
            data: { precision: 2 },
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
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
            type: 'MA-12',
            data: { mixed: true },
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            // 2.5 = 2 1/2
            in: PayloadUtils.createScalar(2.5)
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(val.int.value).toBe(2);
        expect(val.numerator.value).toBe(1);
        expect(val.denominator.value).toBe(2);
        expect(val.string.value).toBe('2 1/2');
    });

    test('MA-12: Should handle mixed fractions with integer result', async () => {
        const node = {
            id: 'test-mixed-int',
            type: 'MA-12',
            data: { mixed: true },
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in: PayloadUtils.createScalar(3)
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = result.value as any;

        expect(val.int.value).toBe(3);
        expect(val.numerator.value).toBe(0);
        expect(val.denominator.value).toBe(1);
        expect(val.string.value).toBe('3');
    });
});
