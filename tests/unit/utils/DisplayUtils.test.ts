import { describe, it, expect } from 'vitest';
import { DisplayUtils } from '@/utils/DisplayUtils';
import { DataType } from '@/types/payload';

describe('DisplayUtils.formatValue', () => {
    it('should format dehydrated BigNumber correctly', () => {
        const val = { mathjs: 'BigNumber', value: '123.456' };
        expect(DisplayUtils.formatValue(val)).toBe('123.456');
    });

    it('should format dehydrated Fraction correctly', () => {
        const val = { mathjs: 'Fraction', n: 1, d: 3 };
        expect(DisplayUtils.formatValue(val)).toBe('1/3');
    });

    it('should format dehydrated Complex correctly', () => {
        const val = { mathjs: 'Complex', re: 2, im: -3 };
        expect(DisplayUtils.formatValue(val)).toBe('2-3i');
    });

    it('should format dehydrated Unit correctly', () => {
        const val = { mathjs: 'Unit', value: 10, unit: 'm' };
        expect(DisplayUtils.formatValue(val)).toBe('10 m');
    });

    it('should format dehydrated Array correctly', () => {
        const val = { mathjs: 'Matrix', data: [1, 2, 3] };
        expect(DisplayUtils.formatValue(val)).toBe('[1, 2, 3]');
    });

    it('should handle nested dehydrated objects in Arrays', () => {
        const val = [{ mathjs: 'BigNumber', value: '42' }, { mathjs: 'BigNumber', value: '100' }];
        expect(DisplayUtils.formatValue(val)).toBe('[42, 100]');
    });

    it('should handle NodePayload with DataType.Scalar containing dehydrated BigNumber', () => {
        const payload = {
            type: DataType.Scalar,
            value: { mathjs: 'BigNumber', value: '987654321' },
            symbol: null,
            meta: {}
        };
        expect(DisplayUtils.formatValue(payload)).toBe('987654321');
    });

    it('should handle DataType.Object payloads by formatting keys and values', () => {
        const payload = {
            type: DataType.Object,
            value: {
                a: { mathjs: 'BigNumber', value: '10' },
                b: 'text'
            },
            symbol: null,
            meta: {}
        };
        const result = DisplayUtils.formatValue(payload);
        expect(result).toContain('a: 10');
        expect(result).toContain('b: text');
    });

    it('should handle deprecated DataType.Matrix payloads', () => {
        const payload = {
            type: 'matrix' as any,
            value: [[1, 2], [3, 4]],
            symbol: null,
            meta: {}
        };
        expect(DisplayUtils.formatValue(payload)).toBe('[[1, 2], [3, 4]]');
    });
});


