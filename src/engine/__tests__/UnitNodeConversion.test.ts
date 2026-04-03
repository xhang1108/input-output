import { test, expect, beforeAll } from 'vitest';
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { DataType } from '../../types/payload';
import { InputOutputEngine } from '../InputOutputEngine';

beforeAll(() => {
    NodeRegistry.initializeNodes();
});

// Helper for TR-01 evaluation
async function evalUnitNode(unit: string, isCustom: boolean, inputPayload?: any) {
    const node = { 
        id: 'test-unit', 
        type: 'TR-01', 
        data: isCustom ? { unit: 'CUSTOM', customUnit: unit } : { unit } 
    } as any;
    const inputs = (inputPayload ? { in_a: inputPayload } : {}) as Record<string, any>;
    const result = (await NodeRegistry.evaluate(node, inputs)) as any;
    if (result && result.value && typeof result.value === 'object' && result.value.mathjs) {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const hydrated = PayloadUtils.hydrate(result.value, math) as any;
        result.value = hydrated.toNumber ? hydrated.toNumber() : Number(hydrated);
    }
    return result;
}

test('UnitNode: Labeling mode (No input unit)', async () => {
    // 10 -> [Unit: km] -> 10km
    const res = await evalUnitNode('km', false, PayloadUtils.createScalar(10));
    expect(res.value).toBe(10);
    expect(res.meta?.unit).toBe('km');
});

test('UnitNode: Automatic conversion (s to min)', async () => {
    // 60s -> [Unit: min] -> 1min
    const res = await evalUnitNode('min', false, PayloadUtils.createScalar(60, 's'));
    expect(res.value).toBe(1);
    expect(res.meta?.unit).toBe('min');
});

test('UnitNode: Automatic conversion (61s to min)', async () => {
    // 61s -> [Unit: min] -> 1.0166... min
    const res = await evalUnitNode('min', false, PayloadUtils.createScalar(61, 's'));
    expect(res.value).toBeCloseTo(1.016666, 5);
    expect(res.meta?.unit).toBe('min');
});

test('UnitNode: Conversion with Custom Units', async () => {
    // 1000m -> [Custom Unit: km] -> 1km
    const res = await evalUnitNode('km', true, PayloadUtils.createScalar(1000, 'm'));
    expect(res.value).toBe(1);
    expect(res.meta?.unit).toBe('km');
});

test('UnitNode: 0.9833h to min (User reported case)', async () => {
    // 0.9833h -> [Unit: min] -> 58.998 min
    const res = await evalUnitNode('min', false, PayloadUtils.createScalar(0.9833, 'h'));
    expect(res.value).toBeCloseTo(58.998, 3);
    expect(res.meta?.unit).toBe('min');
});

test('UnitNode: Incompatible units error', async () => {
    // 1s -> [Unit: km] -> Error
    const res = await evalUnitNode('km', false, PayloadUtils.createScalar(1, 's'));
    expect(res.type).toBe(DataType.Error);
    expect((res as any).meta?.error).toContain('Cannot convert s to km');
});

test('UnitNode: Unknown custom units fallback to labeling if no source unit', async () => {
    // 10 -> [Custom Unit: apple] -> 10 apple
    const res = await evalUnitNode('apple', true, PayloadUtils.createScalar(10));
    expect(res.value).toBe(10);
    expect(res.meta?.unit).toBe('apple');
});

test('UnitNode: Unknown custom units error if source unit exists', async () => {
    // 10m -> [Custom Unit: apple] -> Error (because mathjs cannot convert m to apple)
    const res = await evalUnitNode('apple', true, PayloadUtils.createScalar(10, 'm'));
    expect(res.type).toBe(DataType.Error);
    expect((res as any).meta?.error).toContain('Cannot convert m to apple');
});
