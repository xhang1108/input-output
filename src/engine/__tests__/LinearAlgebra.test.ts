import { describe, test, expect, beforeAll } from 'vitest';
import { NodeRegistry } from '../NodeRegistry';
import { DataType } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { CalctopusEngine } from '../CalctopusEngine';

describe('Linear Algebra & Array Nodes', () => {
    beforeAll(() => {
        CalctopusEngine.getInstance();
    });

    test('AD-01 (MatrixTools): QR Decomposition Multi-Output', async () => {
        const node = {
            id: 'n1',
            type: 'AD-01',
            data: { op: 'QR' } as any,
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in: PayloadUtils.createMatrix([
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
        expect(val.Q.type).toBe(DataType.Matrix);
        expect(val.R.type).toBe(DataType.Matrix);
    });

    test('DA-06 (ArrayExtract): Extract scalar from array', async () => {
        const node = {
            id: 'n2',
            type: 'DA-06',
            data: {},
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in: PayloadUtils.createMatrix([10, 20, 30] as any),
            index: PayloadUtils.createScalar(1) // 0-based in JS API (mathjs matrix index subset is 0-based)
        };

        const result = await NodeRegistry.evaluate(node as any, inputs);
        expect(result.type).toBe(DataType.Scalar);
        expect(result.value).toBe(20);
    });

    test('DA-07 (ArrayBuilder): Combine scalars to array', async () => {
        const node = {
            id: 'n3',
            type: 'DA-07',
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
        expect(result.type).toBe(DataType.Matrix);

        // Output format could be JS array or MathJS matrix object, let's just check dehydration success
        expect(result.value).toBeDefined();

        // In mathjs dehydrated format, it will be { mathjs: 'Matrix', data: [...] } if it's a MathJS obj
        // Or it will just be a plain array if it dehydrates to standard JS array (PayloadUtils unwraps arrays)
    });
    test('DA-07 (ArrayBuilder): Combine scalars to array using single Capsule Handle', async () => {
        const node = {
            id: 'n4',
            type: 'DA-07',
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
        expect(result.type).toBe(DataType.Matrix);

        // Output format should successfully dehydrate
        expect(result.value).toBeDefined();

        const math = CalctopusEngine.getInstance().getMathInstance();
        const hydrated = PayloadUtils.hydrate(result.value, math);

        // Assert the array contains exactly 10, 20, 30
        const arr = (hydrated as any).toArray ? (hydrated as any).toArray() : hydrated;
        expect(arr).toEqual([10, 20, 30]);
    });
});
