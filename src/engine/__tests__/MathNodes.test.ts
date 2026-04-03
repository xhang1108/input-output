import { test, expect, beforeAll } from 'vitest';
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { DataType } from '../../types/payload';

beforeAll(() => {
    NodeRegistry.initializeNodes();
});

import { InputOutputEngine } from '../InputOutputEngine';

// Helper for quick evaluation
async function evalMath(type: string, op: string, inputs: any) {
    const node = { id: `test-${type}`, type, data: { op } } as any;
    const result = (await NodeRegistry.evaluate(node, inputs)) as any;
    if (result && result.value && typeof result.value === 'object' && result.value.mathjs) {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const hydrated = PayloadUtils.hydrate(result.value, math) as any;
        result.value = hydrated.toNumber ? hydrated.toNumber() : Number(hydrated);
    }
    return result;
}

test('MA-01 Basic Math: Operations and Unit Propagation', async () => {
    // 1. Basic scalar division: 10 / 2 = 5
    const resDiv = await evalMath('MA-01', 'DIV', {
        in_a: PayloadUtils.createScalar(10),
        in_b: PayloadUtils.createScalar(2)
    });
    expect(resDiv.value).toBeCloseTo(5);

    // 2. Unit addition: 5m + 3m = 8m
    const resAdd = await evalMath('MA-01', 'ADD', {
        in_a: PayloadUtils.createScalar(5, 'm'),
        in_b: PayloadUtils.createScalar(3, 'm')
    });
    expect(resAdd.value).toBeCloseTo(8);
    expect(resAdd.meta?.unit).toBe('m'); // Should propagate identical units

    // 3. Mixed unit addition: 5kg + 0 = 5kg (Second unit is default 0)
    const resMixed = await evalMath('MA-01', 'ADD', {
        in_a: PayloadUtils.createScalar(5, 'kg'),
        in_b: PayloadUtils.createScalar(0)
    });
    expect(resMixed.value).toBeCloseTo(5);
    expect(resMixed.meta?.unit).toBe('kg');
});

test('MA-01 Unit Conversion: Same-dimension ADD converts correctly', async () => {
    // km + m → should convert m to km and add: 1km + 500m = 1.5km
    const res = await evalMath('MA-01', 'ADD', {
        in_a: PayloadUtils.createScalar(1, 'km'),
        in_b: PayloadUtils.createScalar(500, 'm')
    });
    expect(Number(res.value)).toBeCloseTo(1.5);
    expect(res.meta?.unit).toBe('km');
});

test('MA-01 Unit Conversion: Same-dimension SUB converts correctly', async () => {
    // 1km - 200m = 0.8km
    const res = await evalMath('MA-01', 'SUB', {
        in_a: PayloadUtils.createScalar(1, 'km'),
        in_b: PayloadUtils.createScalar(200, 'm')
    });
    expect(Number(res.value)).toBeCloseTo(0.8);
    expect(res.meta?.unit).toBe('km');
});

test('MA-01 Unit Conversion: Triple mixed units ADD', async () => {
    // 1km + 1.01m = 1.00101 km
    const res = await evalMath('MA-01', 'ADD', {
        in_a: PayloadUtils.createScalar(1, 'km'),
        in_b: PayloadUtils.createScalar(1.01, 'm')
    });
    expect(Number(res.value)).toBeCloseTo(1.00101, 5);
    expect(res.meta?.unit).toBe('km');
});

test('MA-01 Unit Error: Incompatible dimensions return error', async () => {
    // s + km → error (time + distance)
    const res = await evalMath('MA-01', 'ADD', {
        in_a: PayloadUtils.createScalar(1, 's'),
        in_b: PayloadUtils.createScalar(1, 'km')
    });
    expect(res.meta?.error).toBeDefined();
});

test('MA-01 Unit Algebra: MUL produces correct compound unit', async () => {
    // km * km → km^2
    const res = await evalMath('MA-01', 'MUL', {
        in_a: PayloadUtils.createScalar(3, 'km'),
        in_b: PayloadUtils.createScalar(4, 'km')
    });
    expect(res.value).toBeCloseTo(12);
    expect(res.meta?.unit).toBe('km^2');
});

test('MA-01 Handle ID Resilience', async () => {
    // Passing non-existent handles like 'foo'. The engine should default inputs to 0. 0 + 0 = 0.
    const resDefault = await evalMath('MA-01', 'ADD', {
        foo: PayloadUtils.createScalar(10)
    });
    expect(resDefault.value).toBe(0);
});

test('MA-02 Advanced Math: Full Operator Coverage', async () => {
    // 1. NEG: -(-5) = 5
    const resNeg = await evalMath('MA-02', 'NEG', { in_a: PayloadUtils.createScalar(-5) });
    expect(resNeg.value).toBe(5);

    // 2. SIGN: Sign(-100) = -1
    const resSign = await evalMath('MA-02', 'SIGN', { in_a: PayloadUtils.createScalar(-100) });
    expect(resSign.value).toBe(-1);

    const resSignPos = await evalMath('MA-02', 'SIGN', { in_a: PayloadUtils.createScalar(42) });
    expect(resSignPos.value).toBe(1);

    const resSignZero = await evalMath('MA-02', 'SIGN', { in_a: PayloadUtils.createScalar(0) });
    expect(resSignZero.value).toBe(0);

    // 3. CBRT: ∛27 = 3
    const result = await evalMath('MA-02', 'CBRT', { in_a: PayloadUtils.createScalar(27) });
    expect(result.type).toBe(DataType.Scalar);
    const val = PayloadUtils.unwrap(result) as any;
    expect(String(val.value || val)).toBe('3');

    // 4. FACT: 5! = 120
    const resFact = await evalMath('MA-02', 'FACT', { in_a: PayloadUtils.createScalar(5) });
    expect(resFact.value).toBe(120);

    // 5. POW: 2^3 = 8
    const resPow = await evalMath('MA-02', 'POW', {
        in_a: PayloadUtils.createScalar(2),
        in_b: PayloadUtils.createScalar(3)
    });
    expect(resPow.value).toBe(8);

    // 6. SQRT: √16 = 4
    const resSqrt = await evalMath('MA-02', 'SQRT', { in_a: PayloadUtils.createScalar(16) });
    expect(resSqrt.value).toBe(4);

    // 7. ABS: |-7| = 7
    const resAbs = await evalMath('MA-02', 'ABS', { in_a: PayloadUtils.createScalar(-7) });
    expect(resAbs.value).toBe(7);
});

test('MA-03 Logarithm: Operations and Handle Fallback', async () => {
    // 1. LN via 'in_a'
    const resLn = await evalMath('MA-03', 'LN', { in_a: PayloadUtils.createScalar(Math.E) });
    expect(resLn.value).toBeCloseTo(1, 10);

    // 2. LOG10 via 'in_a'
    const resLog10 = await evalMath('MA-03', 'LOG10', { in_a: PayloadUtils.createScalar(100) });
    expect(resLog10.value).toBeCloseTo(2, 10);

    // 3. LOGN via 'in_a' and 'base'
    const resLogn = await evalMath('MA-03', 'LOGN', {
        in_a: PayloadUtils.createScalar(16),
        in_b: PayloadUtils.createScalar(2)
    });
    expect(resLogn.value).toBeCloseTo(4, 10);
});

test('MA-04 Trigonometry: Operations and Handle Fallback', async () => {
    // 1. SIN via 'in_a'
    const resSin = await evalMath('MA-04', 'SIN', { in_a: PayloadUtils.createScalar(Math.PI / 2) });
    expect(resSin.value).toBeCloseTo(1, 10);

    // 2. COS via 'in_a'
    const resCos = await evalMath('MA-04', 'COS', { in_a: PayloadUtils.createScalar(0) });
    expect(resCos.value).toBeCloseTo(1, 10);
});

test('Data Type Edge Cases: Strings and Unrelated Types', async () => {
    // Passing a literal string into addition should gracefully result in an Error Payload or NaN without engine crashing
    const resStr = await evalMath('MA-01', 'ADD', {
        in_a: PayloadUtils.createString('Apple'),
        in_b: PayloadUtils.createScalar(2)
    });
    // In current implementation, mathjs doesn't crash on this, it throws internal errors which evaluates to Error Payload
    expect(resStr).toBeDefined();
    expect([DataType.Error, DataType.String, DataType.Scalar].includes(resStr.type)).toBeTruthy();
});
