import { describe, test, expect, beforeAll } from 'vitest';
import { NodeRegistry, initializeNodes } from '@/engine/NodeRegistry';
import { DataType } from '@/types/payload';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { InputOutputEngine } from '@/engine/InputOutputEngine';

describe('Linear Algebra & Array Nodes', () => {
    beforeAll(() => {
        InputOutputEngine.getInstance();
        initializeNodes();
    });

    test('DT-06 (Array Calculus): QR Decomposition Multi-Output', async () => {
        const node = {
            id: 'n1',
            type: 'DT-06',
            data: { op: 'QR' } as any,
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: PayloadUtils.createArray([
                [12, -51, 4],
                [6, 167, -68],
                [-4, 24, -41]
            ] as any)
        };

        const result = await NodeRegistry.evaluate(node as any, inputs);

        expect(result.type).toBe(DataType.Object);
        // multi-output should contain 'out_a' (Q) and 'out_b' (R) keys
        const val = result.value as any;
        expect(val.out_a).toBeDefined();
        expect(val.out_b).toBeDefined();
        expect(val.out_a.type).toBe(DataType.Array);
        expect(val.out_b.type).toBe(DataType.Array);
    });

    test('DT-06 (Array Calculus): LUP and LU Decomposition', async () => {
        const inputA = PayloadUtils.createArray([[4, 3], [6, 3]] as any);

        // 1. LUP (3 outputs)
        const nodeLUP = { id: 'n-lup', type: 'DT-06', data: { op: 'LUP' } };
        const resLUP = await NodeRegistry.evaluate(nodeLUP as any, { in_a: inputA });
        expect(resLUP.type).toBe(DataType.Object);
        const valLUP = resLUP.value as any;
        expect(valLUP.out_a).toBeDefined(); // L
        expect(valLUP.out_b).toBeDefined(); // U
        expect(valLUP.out_c).toBeDefined(); // P
        expect(valLUP.out_a.type).toBe(DataType.Array);

        // 2. LU (2 outputs)
        const nodeLU = { id: 'n-lu', type: 'DT-06', data: { op: 'LU' } };
        const resLU = await NodeRegistry.evaluate(nodeLU as any, { in_a: inputA });
        expect(resLU.type).toBe(DataType.Object);
        const valLU = resLU.value as any;
        expect(valLU.out_a).toBeDefined(); // L
        expect(valLU.out_b).toBeDefined(); // U
        expect(valLU.out_c).toBeUndefined(); // P should be hidden/undefined in LU mode
    });

    test('DT-06 (Array Calculus): EIGEN Spectral Decomposition', async () => {
        const node = { id: 'n-eig', type: 'DT-06', data: { op: 'EIGEN' } };
        const inputs = { in_a: PayloadUtils.createArray([[2, 0], [0, 5]]) };

        const result = await NodeRegistry.evaluate(node as any, inputs);
        expect(result.type).toBe(DataType.Object);
        const val = result.value as any;
        
        // out_a: eigenvalues [2, 5]
        expect(val.out_a.type).toBe(DataType.Array);
        expect(val.out_a.value).toEqual([2, 5]);

        // out_b: eigenvectors matrix (Identity for diagonal matrix)
        expect(val.out_b.type).toBe(DataType.Array);
        // mathjs might return Matrix object or flat array based on dehydration logic
        // but it must be valid array/matrix data
        expect(val.out_b.value).toBeDefined();
    });

    test('DT-06 (Array Calculus): Scalar modes (DET, TRACE)', async () => {
        const inputs = { in_a: PayloadUtils.createArray([[1, 2], [3, 4]]) };

        // 1. DET
        const nodeDet = { id: 'n-det', type: 'DT-06', data: { op: 'DET' } };
        const resDet = await NodeRegistry.evaluate(nodeDet as any, inputs);
        expect(resDet.type).toBe(DataType.Scalar);
        expect(resDet.value).toBe(-2);

        // 2. TRACE
        const nodeTrace = { id: 'n-tr', type: 'DT-06', data: { op: 'TRACE' } };
        const resTrace = await NodeRegistry.evaluate(nodeTrace as any, inputs);
        expect(resTrace.type).toBe(DataType.Scalar);
        expect(resTrace.value).toBe(5);
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
            in_a: PayloadUtils.createArray([10, 20, 30] as any),
            in_b: PayloadUtils.createScalar(2) // 1-based (2nd element is 20)
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
            in_a: PayloadUtils.createArray([
                [11, 12],
                [21, 22]
            ] as any),
            in_b: PayloadUtils.createArray([2, 1] as any) // Row 2, Col 1 -> 21
        };

        const result = await NodeRegistry.evaluate(node as any, inputs);
        expect(result.type).toBe(DataType.Scalar);
        expect(result.value).toBe(21);
    });

    test('DT-01 (ArrayBuilder): Unified Join (Scalar to Vector)', async () => {
        const node = {
            id: 'n4',
            type: 'DT-01',
            data: { axis: 0 } as any,
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: [
                PayloadUtils.createScalar(10),
                PayloadUtils.createScalar(20)
            ]
        };

        const result = await NodeRegistry.evaluate(node as any, inputs as any);
        const math = InputOutputEngine.getInstance().getMathInstance();
        const hydrated = PayloadUtils.hydrate(result.value, math);
        const arr = (hydrated as any).toArray ? (hydrated as any).toArray() : hydrated;
        expect(arr).toEqual([10, 20]);
    });

    test('DT-01 (ArrayBuilder): Unified Join (Vector to Vector)', async () => {
        const node = {
            id: 'n-concat-0',
            type: 'DT-01',
            data: { axis: 0 } as any,
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: [
                PayloadUtils.createArray([1, 2]),
                PayloadUtils.createArray([3, 4])
            ]
        };

        const result = await NodeRegistry.evaluate(node as any, inputs as any);
        const math = InputOutputEngine.getInstance().getMathInstance();
        const hydrated = PayloadUtils.hydrate(result.value, math);
        const arr = (hydrated as any).toArray ? (hydrated as any).toArray() : hydrated;
        expect(arr).toEqual([1, 2, 3, 4]);
    });

    test('DT-01 (ArrayBuilder): Unified Join (Columns)', async () => {
        const node = {
            id: 'n-concat-1',
            type: 'DT-01',
            data: { axis: 1 } as any,
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: [
                PayloadUtils.createArray([[1], [2]]),
                PayloadUtils.createArray([[3], [4]])
            ]
        };

        const result = await NodeRegistry.evaluate(node as any, inputs as any);
        const math = InputOutputEngine.getInstance().getMathInstance();
        const hydrated = PayloadUtils.hydrate(result.value, math);
        const arr = (hydrated as any).toArray ? (hydrated as any).toArray() : hydrated;
        expect(arr).toEqual([[1, 3], [2, 4]]);
    });

    test('DT-01 (ArrayBuilder): Scalars to Columns', async () => {
        const node = {
            id: 'n-scalar-cols',
            type: 'DT-01',
            data: { axis: 1 } as any,
            value: { type: DataType.Scalar as any, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            in_a: [
                PayloadUtils.createScalar(10),
                PayloadUtils.createScalar(20)
            ]
        };

        const result = await NodeRegistry.evaluate(node as any, inputs as any);
        const math = InputOutputEngine.getInstance().getMathInstance();
        const hydrated = PayloadUtils.hydrate(result.value, math);
        const arr = (hydrated as any).toArray ? (hydrated as any).toArray() : hydrated;
        // Should be [[10, 20]] (2D horizontal matrix)
        expect(arr).toEqual([[10, 20]]);
    });
});

