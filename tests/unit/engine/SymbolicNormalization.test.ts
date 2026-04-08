import { describe, test, expect, beforeEach } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { DataType } from '@/types/payload';
import { InputOutputEngine } from '@/engine/InputOutputEngine';

describe('Symbolic Normalization (PayloadUtils + NerdamerService)', () => {
    beforeEach(() => {
        NodeRegistry.initializeNodes();
    });

    const math = InputOutputEngine.getInstance().getMathInstance();

    describe('Proactive Normalization (PayloadUtils)', () => {
        test('should normalize pow(a, b) to (a)^(b)', () => {
            const expr = 'pow(x, 2)';
            const normalized = PayloadUtils.normalizeMathExpression(expr, math);
            expect(normalized).toBe('x ^ 2');
        });

        test('should normalize nthRoot(a, b) to (a)^(1/(b))', () => {
            const expr = 'nthRoot(x, 3)';
            const normalized = PayloadUtils.normalizeMathExpression(expr, math);
            expect(normalized).toBe('x ^ (1 / 3)');
        });

        test('should normalize root(a, b) to (a)^(1/(b))', () => {
            const expr = 'root(x, 3)';
            const normalized = PayloadUtils.normalizeMathExpression(expr, math);
            expect(normalized).toBe('x ^ (1 / 3)');
        });

        test('should handle nested normalization: pow(nthRoot(x, 3), 2)', () => {
            const expr = 'pow(nthRoot(x, 3), 2)';
            const normalized = PayloadUtils.normalizeMathExpression(expr, math);
            expect(normalized).toBe('(x ^ (1 / 3)) ^ 2');
        });

        test('should prevent Nerdamer truncation for complex formulas', async () => {
            // Formula: pow(x, 2) + y
            // Without fix, Nerdamer might truncate everything after pow.
            const expr = 'pow(x, 2) + y';
            const normalized = PayloadUtils.normalizeMathExpression(expr, math);
            
            // To be truly robust, we verify that compilation includes both terms
            const node = {
                id: 'exp-1',
                type: 'IN-09',
                data: { code: expr },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            // Use direct evaluator check if possible or NodeRegistry.evaluate
            // For IN-09, result is Symbolic payload
            const result = await NodeRegistry.evaluate(node, {});
            expect(result.type).toBe(DataType.Symbolic);
            
            // Now test evaluation of that symbolic payload via PlotNode or a test helper
            // We'll simulate the compilation flow in NerdamerService
            const { NerdamerService } = await import('@/engine/calculus/NerdamerService');
            const svc = NerdamerService.getInstance();
            const fn = svc.compileToFunction(expr, ['x', 'y']);
            
            expect(fn({ x: 2, y: 3 })).toBe(7); // 2^2 + 3 = 7
        });
    });

    describe('De-mangling fallback (NerdamerService)', () => {
        test('should de-mangle multi-argument functions if they bypass normalization', async () => {
            const { NerdamerService } = await import('@/engine/calculus/NerdamerService');
            const svc = NerdamerService.getInstance();
            
            // hypot is NOT in the proactive list but IS in the de-mangler list
            const expr = 'hypot(3, 4)';
            const fn = svc.compileToFunction(expr, []);
            expect(fn({})).toBe(5);
        });
    });
});
