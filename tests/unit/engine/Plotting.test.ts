import { describe, test, it, expect, beforeEach } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { DataType } from '@/types/payload';
import { NerdamerService } from '@/engine/calculus/NerdamerService';

describe('Plotting System (NerdamerService + OT-03 PlotNode)', () => {
    beforeEach(() => {
        NodeRegistry.initializeNodes();
    });

    describe('Nerdamer Function Compilation', () => {
        const svc = NerdamerService.getInstance();

        test('should correctly compile exp(x) and handle e constant', () => {
            const fn = svc.compileToFunction('exp(x)', ['x']);
            expect(fn({ x: 0 })).toBe(1);
            expect(fn({ x: 1 })).toBeCloseTo(2.718, 3);
        });

        test('should correctly compile abs(x)', () => {
            const fn = svc.compileToFunction('abs(x)', ['x']);
            expect(fn({ x: -5 })).toBe(5);
            expect(fn({ x: 5 })).toBe(5);
        });

        test('should handle pi constant', () => {
            const fn = svc.compileToFunction('sin(pi/2)', []);
            expect(fn({})).toBe(1);
        });

        test('should handle complex butterfly formula', () => {
            const formula = 'sin(x) * (exp(cos(x)) - 2*cos(4*x) - sin(x/12)^5)';
            const fn = svc.compileToFunction(formula, ['x']);
            expect(fn({ x: 0 })).toBeCloseTo(0, 10);
            
            const val2 = fn({ x: Math.PI / 2 });
            expect(val2).toBeLessThan(-0.9);
            expect(val2).toBeGreaterThan(-1.1);
        });
    });

    describe('OT-03 PlotNode Integration', () => {
        it('should extract formula from Expression Node output', async () => {
            const expressionNode = {
                id: 'node-expr',
                type: 'IN-09',
                data: { code: 'x = 2' }
            };

            const exprResult = await NodeRegistry.evaluate(expressionNode as any, {});
            expect(exprResult.type).toBe(DataType.Symbolic);
            expect(exprResult.value).toBe('x = 2');

            const plotNode = {
                id: 'node-plot',
                type: 'OT-03',
                data: { mode: 'fx' }
            };

            const result = await NodeRegistry.evaluate(plotNode as any, { 'in_a': exprResult });
            expect(result.type).toBe(DataType.Object);
            expect((result.value as any).formula).toBe('x = 2');
        });

        it('should handle pure Symbolic input as fallback', async () => {
            const symbolicPayload = {
                type: DataType.Symbolic,
                value: 'sin(x)',
                symbol: null,
                meta: {}
            };

            const plotNode = {
                id: 'node-plot',
                type: 'OT-03',
                data: { mode: 'fx' }
            };

            const result = await NodeRegistry.evaluate(plotNode as any, { 'in_a': symbolicPayload });
            expect(result.type).toBe(DataType.Object);
            expect((result.value as any).formula).toBe('sin(x)');
        });
    });
});
