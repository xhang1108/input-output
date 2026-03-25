import { describe, test, expect, beforeAll } from 'vitest';
import { NodeRegistry, initializeNodes } from '../NodeRegistry';
import { DataType } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { InputOutputEngine } from '../InputOutputEngine';

describe('Linear Algebra & Array Nodes', () => {
    beforeAll(() => {
        InputOutputEngine.getInstance();
        initializeNodes();
    });

    test('DT-06 (MatrixTools): QR Decomposition Multi-Output', async () => {
        const node = {
            id: 'n1',
            type: 'DT-06',
            data: { op: 'QR' } as any,
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in: PayloadUtils.createArray([
                [12, -51, 4],
                [6, 167, -68],
                [-4, 24, -41]
            ] as any)
        };

        const result = await NodeRegistry.evaluate(node as any, inputs);

        expect(result.type).toBe(DataType.Object);
        // multi-output should contain 'Q' and 'R' keys
        const val = result.value as any;
        expect(val.Q).toBeDefined();
        expect(val.R).toBeDefined();
        expect(val.Q.type).toBe(DataType.Array);
        expect(val.R.type).toBe(DataType.Array);
    });

    test('DT-02 (ArrayExtract): Extract scalar from array', async () => {
        const node = {
            id: 'n2',
            type: 'DT-02',
            data: {},
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in: PayloadUtils.createArray([10, 20, 30] as any),
            index: PayloadUtils.createScalar(2) // 1-based (2nd element is 20)
        };

        const result = await NodeRegistry.evaluate(node as any, inputs);
        expect(result.type).toBe(DataType.Scalar);
        expect(result.value).toBe(20);
    });

    test('DT-02 (ArrayExtract): Extract from 2D Matrix', async () => {
        const node = {
            id: 'n2-2d',
            type: 'DT-02',
            data: { indexMode: '2D' },
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in: PayloadUtils.createArray([
                [11, 12],
                [21, 22]
            ] as any),
            index: PayloadUtils.createArray([2, 1] as any) // Row 2, Col 1 -> 21
        };

        const result = await NodeRegistry.evaluate(node as any, inputs);
        expect(result.type).toBe(DataType.Scalar);
        expect(result.value).toBe(21);
    });

    test('DT-01 (ArrayBuilder): Combine scalars to array', async () => {
        const node = {
            id: 'n3',
            type: 'DT-01',
            data: { axis: 0, count: 3 } as any,
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_0: PayloadUtils.createScalar(10),
            in_1: PayloadUtils.createScalar(20),
            in_2: PayloadUtils.createScalar(30)
        };

        const result = await NodeRegistry.evaluate(node as any, inputs);
        expect(result.type).toBe(DataType.Array);

        // Output format could be JS array or MathJS matrix object, let's just check dehydration success
        expect(result.value).toBeDefined();

        // In mathjs dehydrated format, it will be { mathjs: 'Matrix', data: [...] } if it's a MathJS obj
        // Or it will just be a plain array if it dehydrates to standard JS array (PayloadUtils unwraps arrays)
    });
    test('DT-01 (ArrayBuilder): Combine scalars to array using single Capsule Handle', async () => {
        const node = {
            id: 'n4',
            type: 'DT-01',
            data: { axis: 0 } as any, // No count needed anymore
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in: [
                PayloadUtils.createScalar(10),
                PayloadUtils.createScalar(20),
                PayloadUtils.createScalar(30)
            ]
        };

        const result = await NodeRegistry.evaluate(node as any, inputs as any);
        expect(result.type).toBe(DataType.Array);

        // Output format should successfully dehydrate
        expect(result.value).toBeDefined();

        const math = InputOutputEngine.getInstance().getMathInstance();
        const hydrated = PayloadUtils.hydrate(result.value, math);

        // Assert the array contains exactly 10, 20, 30
        const arr = (hydrated as any).toArray ? (hydrated as any).toArray() : hydrated;
        expect(arr).toEqual([10, 20, 30]);
    });
});
