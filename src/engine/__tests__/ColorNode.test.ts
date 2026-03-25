import { describe, test, expect } from 'vitest';
import { DataType } from '../../types/payload';
import { IOEvaluators } from '../nodes/Evaluators/IO/IOEvaluators';
import { ColorUtils } from '../../utils/ColorUtils';

describe('Color Node (IN-03) & ColorUtils', () => {
    test('ColorUtils.standardize - HEX string', () => {
        const res = ColorUtils.standardize('#ff0000');
        expect(res.type).toBe(DataType.Color);
        expect((res.value as any).out_a).toBe('ff0000');
        expect((res.value as any).out_b).toEqual([255, 0, 0]);
        expect((res.value as any).out_c).toEqual([1, 0, 0]);
    });

    test('ColorUtils.standardize - RGB Array (8bit)', () => {
        const res = ColorUtils.standardize([255, 128, 0], '8bit');
        expect((res.value as any).out_a).toBe('ff8000');
        expect((res.value as any).out_b).toEqual([255, 128, 0]);
    });

    test('ColorUtils.standardize - Vec3 Array', () => {
        const res = ColorUtils.standardize([0.5, 1, 0], '8bit', 'vec3');
        expect((res.value as any).out_a).toBe('80ff00');
        expect((res.value as any).out_c).toEqual([0.5, 1, 0]);
    });

    test('IN-03 Evaluator - Standard Source Behavior', () => {
        const node: any = {
            id: 'node_1',
            type: 'IN-03',
            data: { depth: '8bit' },
            value: { 
                type: DataType.Color, 
                value: { out_a: 'ff00ff', out_b: [255, 0, 255], out_c: [1, 0, 1] }, 
                symbol: null, 
                meta: { role: 'color' } 
            }
        };
        
        const result = IOEvaluators['IN-03'](node, {});
        expect((result as any).value.out_a).toBe('ff00ff');
    });

    test('ColorUtils - Handles raw array input (UI Sync Pattern)', () => {
        const res = ColorUtils.standardize([0, 255, 128], '8bit');
        expect((res as any).value.out_a).toBe('00ff80');
    });
});
