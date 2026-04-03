import { describe, it, expect } from 'vitest';
import { UnitAlgebra } from '@/utils/UnitAlgebra';

describe('UnitAlgebra', () => {
    // ─── PARSE ───
    describe('parse', () => {
        it('should parse a simple unit', () => {
            const map = UnitAlgebra.parse('km');
            expect(map.get('km')).toBe(1);
            expect(map.size).toBe(1);
        });

        it('should parse a unit with power', () => {
            const map = UnitAlgebra.parse('km^2');
            expect(map.get('km')).toBe(2);
        });

        it('should parse compound numerator', () => {
            const map = UnitAlgebra.parse('N*m');
            expect(map.get('N')).toBe(1);
            expect(map.get('m')).toBe(1);
        });

        it('should parse division', () => {
            const map = UnitAlgebra.parse('m/s');
            expect(map.get('m')).toBe(1);
            expect(map.get('s')).toBe(-1);
        });

        it('should parse complex unit: m/s^2', () => {
            const map = UnitAlgebra.parse('m/s^2');
            expect(map.get('m')).toBe(1);
            expect(map.get('s')).toBe(-2);
        });

        it('should parse compound numerator with denominator: kg*m/s^2', () => {
            const map = UnitAlgebra.parse('kg*m/s^2');
            expect(map.get('kg')).toBe(1);
            expect(map.get('m')).toBe(1);
            expect(map.get('s')).toBe(-2);
        });

        it('should parse custom labels', () => {
            const map = UnitAlgebra.parse('apple');
            expect(map.get('apple')).toBe(1);
        });

        it('should return empty map for undefined', () => {
            expect(UnitAlgebra.parse(undefined).size).toBe(0);
        });

        it('should return empty map for empty string', () => {
            expect(UnitAlgebra.parse('').size).toBe(0);
        });
    });

    // ─── OPERATIONS ───
    describe('multiply', () => {
        it('km * km → km^2', () => {
            const a = UnitAlgebra.parse('km');
            const b = UnitAlgebra.parse('km');
            const result = UnitAlgebra.multiply(a, b);
            expect(result.get('km')).toBe(2);
        });

        it('m/s * s → m', () => {
            const a = UnitAlgebra.parse('m/s');
            const b = UnitAlgebra.parse('s');
            const result = UnitAlgebra.multiply(a, b);
            expect(result.get('m')).toBe(1);
            expect(result.has('s')).toBe(false); // s cancels out
        });
    });

    describe('divide', () => {
        it('km / km → dimensionless', () => {
            const a = UnitAlgebra.parse('km');
            const b = UnitAlgebra.parse('km');
            const result = UnitAlgebra.divide(a, b);
            expect(result.size).toBe(0);
        });

        it('km^2 / km → km', () => {
            const a = UnitAlgebra.parse('km^2');
            const b = UnitAlgebra.parse('km');
            const result = UnitAlgebra.divide(a, b);
            expect(result.get('km')).toBe(1);
        });

        it('m / s → m/s', () => {
            const a = UnitAlgebra.parse('m');
            const b = UnitAlgebra.parse('s');
            const result = UnitAlgebra.divide(a, b);
            expect(result.get('m')).toBe(1);
            expect(result.get('s')).toBe(-1);
        });

        it('N*m / m → N', () => {
            const a = UnitAlgebra.parse('N*m');
            const b = UnitAlgebra.parse('m');
            const result = UnitAlgebra.divide(a, b);
            expect(result.get('N')).toBe(1);
            expect(result.has('m')).toBe(false);
        });
    });

    describe('power', () => {
        it('m ^ 3 → m^3', () => {
            const a = UnitAlgebra.parse('m');
            const result = UnitAlgebra.power(a, 3);
            expect(result.get('m')).toBe(3);
        });

        it('m/s ^ 2 → m^2/s^2', () => {
            const a = UnitAlgebra.parse('m/s');
            const result = UnitAlgebra.power(a, 2);
            expect(result.get('m')).toBe(2);
            expect(result.get('s')).toBe(-2);
        });
    });

    describe('equals', () => {
        it('should match identical units', () => {
            expect(UnitAlgebra.equals(
                UnitAlgebra.parse('m/s'),
                UnitAlgebra.parse('m/s')
            )).toBe(true);
        });

        it('should not match different units', () => {
            expect(UnitAlgebra.equals(
                UnitAlgebra.parse('m'),
                UnitAlgebra.parse('s')
            )).toBe(false);
        });
    });

    // ─── FORMAT ───
    describe('format', () => {
        it('should format simple unit', () => {
            expect(UnitAlgebra.format(UnitAlgebra.parse('km'))).toBe('km');
        });

        it('should format powered unit', () => {
            expect(UnitAlgebra.format(UnitAlgebra.parse('km^2'))).toBe('km^2');
        });

        it('should format division', () => {
            expect(UnitAlgebra.format(UnitAlgebra.parse('m/s'))).toBe('m/s');
        });

        it('should format complex unit', () => {
            const map = UnitAlgebra.parse('kg*m/s^2');
            const formatted = UnitAlgebra.format(map)!;
            // Sorted alphabetically: kg, m positive; s negative
            expect(formatted).toContain('kg');
            expect(formatted).toContain('m');
            expect(formatted).toContain('s^2');
        });

        it('should return undefined for dimensionless', () => {
            const result = UnitAlgebra.divide(UnitAlgebra.parse('m'), UnitAlgebra.parse('m'));
            expect(UnitAlgebra.format(result)).toBeUndefined();
        });
    });

    // ─── MERGE (Top-Level API) ───
    describe('merge', () => {
        it('ADD: same unit → preserve', () => {
            expect(UnitAlgebra.merge('km', 'km', 'ADD')).toBe('km');
        });

        it('ADD: different units → combined', () => {
            expect(UnitAlgebra.merge('km', 'L', 'ADD')).toBe('km + L');
        });

        it('ADD: one unitless → preserve other', () => {
            expect(UnitAlgebra.merge('km', undefined, 'ADD')).toBe('km');
            expect(UnitAlgebra.merge(undefined, 'L', 'ADD')).toBe('L');
        });

        it('SUB: same unit → preserve', () => {
            expect(UnitAlgebra.merge('m', 'm', 'SUB')).toBe('m');
        });

        it('MUL: km * km → km^2', () => {
            expect(UnitAlgebra.merge('km', 'km', 'MUL')).toBe('km^2');
        });

        it('MUL: m/s * s → m', () => {
            expect(UnitAlgebra.merge('m/s', 's', 'MUL')).toBe('m');
        });

        it('MUL: one unitless → preserve other', () => {
            expect(UnitAlgebra.merge('km', undefined, 'MUL')).toBe('km');
            expect(UnitAlgebra.merge(undefined, 'L', 'MUL')).toBe('L');
        });

        it('DIV: km / km → undefined (dimensionless)', () => {
            expect(UnitAlgebra.merge('km', 'km', 'DIV')).toBeUndefined();
        });

        it('DIV: m / s → m/s', () => {
            expect(UnitAlgebra.merge('m', 's', 'DIV')).toBe('m/s');
        });

        it('DIV: km^2 / km → km', () => {
            expect(UnitAlgebra.merge('km^2', 'km', 'DIV')).toBe('km');
        });

        it('DIV: N*m / m → N', () => {
            expect(UnitAlgebra.merge('N*m', 'm', 'DIV')).toBe('N');
        });

        it('DIV: m/s^2 * s → m/s', () => {
            expect(UnitAlgebra.merge('m/s^2', 's', 'MUL')).toBe('m/s');
        });

        it('MUL: apple * apple → apple^2', () => {
            expect(UnitAlgebra.merge('apple', 'apple', 'MUL')).toBe('apple^2');
        });

        it('DIV: apple^2 / apple → apple', () => {
            expect(UnitAlgebra.merge('apple^2', 'apple', 'DIV')).toBe('apple');
        });

        it('DIV: km/L / km → 1/L (compound fraction cancellation)', () => {
            expect(UnitAlgebra.merge('km/L', 'km', 'DIV')).toBe('1/L');
        });

        it('ABS: preserves unit', () => {
            expect(UnitAlgebra.merge('km', undefined, 'ABS')).toBe('km');
        });

        it('NEG: preserves unit', () => {
            expect(UnitAlgebra.merge('m/s', undefined, 'NEG')).toBe('m/s');
        });

        it('SIGN: drops unit', () => {
            expect(UnitAlgebra.merge('km', undefined, 'SIGN')).toBeUndefined();
        });

        it('no units → undefined', () => {
            expect(UnitAlgebra.merge(undefined, undefined, 'ADD')).toBeUndefined();
        });
    });

    // ─── PRETTIFY ───
    describe('prettify', () => {
        it('should convert ^2 to superscript', () => {
            expect(UnitAlgebra.prettify('km^2')).toBe('km²');
        });

        it('should convert ^3 to superscript', () => {
            expect(UnitAlgebra.prettify('m^3')).toBe('m³');
        });

        it('should convert ^-1 to superscript', () => {
            expect(UnitAlgebra.prettify('s^-1')).toBe('s⁻¹');
        });

        it('should convert * to middle dot', () => {
            expect(UnitAlgebra.prettify('N*m')).toBe('N·m');
        });

        it('should handle complex units', () => {
            expect(UnitAlgebra.prettify('kg*m/s^2')).toBe('kg·m/s²');
        });

        it('should preserve + for mixed units', () => {
            expect(UnitAlgebra.prettify('km + L')).toContain('+');
        });

        it('should return empty string for undefined', () => {
            expect(UnitAlgebra.prettify(undefined)).toBe('');
        });
    });
});

