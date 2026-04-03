import { describe, test, expect } from 'vitest';
import { NerdamerService } from '@/engine/calculus/NerdamerService';

describe('Nerdamer Function Compilation', () => {
    
    test('should correctly compile exp(x) and handle e constant', () => {
        const svc = NerdamerService.getInstance();
        const fn = svc.compileToFunction('exp(x)', ['x']);
        
        // exp(0) = 1
        expect(fn({ x: 0 })).toBe(1);
        // exp(1) = e approx 2.718
        expect(fn({ x: 1 })).toBeCloseTo(2.718, 3);
    });

    test('should correctly compile abs(x)', () => {
        const svc = NerdamerService.getInstance();
        const fn = svc.compileToFunction('abs(x)', ['x']);
        
        expect(fn({ x: -5 })).toBe(5);
        expect(fn({ x: 5 })).toBe(5);
    });

    test('should handle pi constant', () => {
        const svc = NerdamerService.getInstance();
        const fn = svc.compileToFunction('sin(pi/2)', []);
        
        expect(fn({})).toBe(1);
    });

    test('should handle complex formula from user', () => {
        const svc = NerdamerService.getInstance();
        // The butterfly-like formula
        const formula = 'sin(x) * (exp(cos(x)) - 2*cos(4*x) - sin(x/12)^5)';
        const fn = svc.compileToFunction(formula, ['x']);
        
        const val = fn({ x: 0 });
        // sin(0) = 0, so the whole thing should be close to 0 (handles -0 vs +0)
        expect(val).toBeCloseTo(0, 10);

        const val2 = fn({ x: Math.PI / 2 });
        // sin(pi/2)=1, cos(pi/2)=0, exp(0)=1, cos(4*pi/2)=cos(2pi)=1, sin(pi/24)^5 small
        // 1 * (1 - 2*1 - small) = -1 - small
        expect(val2).toBeLessThan(-0.9);
        expect(val2).toBeGreaterThan(-1.1);
    });
});

