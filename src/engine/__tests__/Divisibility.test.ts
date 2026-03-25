import { test, expect, beforeAll } from 'vitest';
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { DataType } from '../../types/payload';

beforeAll(() => {
    NodeRegistry.initializeNodes();
});

// Helper for quick evaluation
async function evalDiv(op: string, inputs: any) {
    const node = { id: `test-MA-07`, type: 'MA-07', data: { op } } as any;
    const result = (await NodeRegistry.evaluate(node, inputs)) as any;
    return result;
}

test('MA-07 GCD: Comprehensive Support', async () => {
    // 1. Array support [24, 36, 48] -> 12
    const resArr = await evalDiv('GCD', { in_a: PayloadUtils.createArray([24, 36, 48]) });
    expect(resArr.value).toBe(12);

    // 2. Dual handle support (A + B) -> GCD(12, 18) = 6
    const resDual = await evalDiv('GCD', { 
        in_a: PayloadUtils.createScalar(12),
        in_b: PayloadUtils.createScalar(18)
    });
    expect(resDual.value).toBe(6);

    // 3. Nested array support [[60, 90], 120] -> 30
    const resNested = await evalDiv('GCD', { in_a: PayloadUtils.createArray([[60, 90], 120]) });
    expect(resNested.value).toBe(30);

    // 4. Empty case -> 0
    const resEmpty = await evalDiv('GCD', { in_a: undefined, in_b: undefined });
    expect(resEmpty.value).toBe(0);
});

test('MA-07 LCM: Comprehensive Support', async () => {
    // 1. Array support [4, 6, 8] -> 24
    const resArr = await evalDiv('LCM', { in_a: PayloadUtils.createArray([4, 6, 8]) });
    expect(resArr.value).toBe(24);

    // 2. Dual handle support (A + B) -> LCM(10, 15) = 30
    const resDual = await evalDiv('LCM', { 
        in_a: PayloadUtils.createScalar(10),
        in_b: PayloadUtils.createScalar(15)
    });
    expect(resDual.value).toBe(30);
});

test('MA-07 MOD: Two-Input and Edge Cases', async () => {
    // 1. Normal Modulo: 10 mod 3 = 1
    const resMod = await evalDiv('MOD', { 
        in_a: PayloadUtils.createScalar(10),
        in_b: PayloadUtils.createScalar(3)
    });
    expect(resMod.value).toBe(1);

    // 2. Array input: [15, 20] mod [4, 5] -> 15 mod 4 = 3
    const resModArr = await evalDiv('MOD', { 
        in_a: PayloadUtils.createArray([15, 20]),
        in_b: PayloadUtils.createArray([4, 5])
    });
    expect(resModArr.value).toBe(3);

    // 3. Division by zero -> Error
    const resZero = await evalDiv('MOD', { 
        in_a: PayloadUtils.createScalar(10),
        in_b: PayloadUtils.createScalar(0)
    });
    expect(resZero.type).toBe(DataType.Error);
});

test('MA-07 ISPRIME: Filtering behavior', async () => {
    // 1. Filtering array [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] -> [2, 3, 5, 7]
    const resArr = await evalDiv('ISPRIME', { in_a: PayloadUtils.createArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) });
    expect(resArr.value).toEqual([2, 3, 5, 7]);

    // 2. Single prime -> [7]
    const resSingle = await evalDiv('ISPRIME', { in_a: PayloadUtils.createScalar(7) });
    expect(resSingle.value).toEqual([7]);

    // 3. Single non-prime -> []
    const resNone = await evalDiv('ISPRIME', { in_a: PayloadUtils.createScalar(10) });
    expect(resNone.value).toEqual([]);
});
