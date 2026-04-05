import { describe, it, expect } from 'vitest';
import { FormulaRenderer } from '@/utils/FormulaRenderer';
import { PayloadUtils } from '@/utils/PayloadUtils';

describe('FormulaRenderer (AST to LaTeX)', () => {
    it('should render literals and identifiers', () => {
        const lit = PayloadUtils.createSymbol('Literal', { value: 42 });
        expect(FormulaRenderer.render(lit)).toBe('42');

        const id = PayloadUtils.createSymbol('Identifier', { name: 'x' });
        expect(FormulaRenderer.render(id)).toBe('x');
    });

    it('should render binary expressions correctly', () => {
        const add = PayloadUtils.createSymbol('BinaryExpression', {
            operator: 'ADD',
            left: PayloadUtils.createSymbol('Identifier', { name: 'a' }),
            right: PayloadUtils.createSymbol('Identifier', { name: 'b' })
        });
        expect(FormulaRenderer.render(add)).toBe('a + b');

        const div = PayloadUtils.createSymbol('BinaryExpression', {
            operator: 'DIV',
            left: PayloadUtils.createSymbol('Literal', { value: 1 }),
            right: PayloadUtils.createSymbol('Literal', { value: 2 })
        });
        expect(FormulaRenderer.render(div)).toBe('\\frac{1}{2}');
    });

    it('should render function calls correctly', () => {
        const sin = PayloadUtils.createSymbol('FunctionCall', {
            name: 'sin',
            args: [PayloadUtils.createSymbol('Identifier', { name: 'theta' })]
        });
        expect(FormulaRenderer.render(sin)).toBe('\\sin{theta}');
    });

    it('should render template literals correctly', () => {
        const template = PayloadUtils.createSymbol('TemplateLiteral', {
            parts: [
                'Result: ',
                PayloadUtils.createSymbol('Literal', { value: 100 })
            ]
        });
        expect(FormulaRenderer.render(template)).toBe('\\text{Result: }100');
    });

    it('should handle expandSymbols option', () => {
        const id = PayloadUtils.createSymbol('Identifier', { name: 'x', value: 5 });
        
        // Default (no expand)
        expect(FormulaRenderer.render(id)).toBe('x');
        
        // Expand enabled
        expect(FormulaRenderer.render(id, { expandSymbols: true })).toBe('5');

        const nested = PayloadUtils.createSymbol('BinaryExpression', {
            operator: 'ADD',
            left: PayloadUtils.createSymbol('Identifier', { name: 'a', value: 10 }),
            right: PayloadUtils.createSymbol('Identifier', { name: 'b', value: 20 })
        });
        
        expect(FormulaRenderer.render(nested)).toBe('a + b');
        expect(FormulaRenderer.render(nested, { expandSymbols: true })).toBe('10 + 20');
    });

    it('should handle operator precedence with parentheses', () => {
        // (a + b) * c
        const complex = PayloadUtils.createSymbol('BinaryExpression', {
            operator: 'MUL',
            left: PayloadUtils.createSymbol('BinaryExpression', {
                operator: 'ADD',
                left: PayloadUtils.createSymbol('Identifier', { name: 'a' }),
                right: PayloadUtils.createSymbol('Identifier', { name: 'b' })
            }),
            right: PayloadUtils.createSymbol('Identifier', { name: 'c' })
        });
        expect(FormulaRenderer.render(complex)).toBe('\\left(a + b\\right) \\cdot c');

        // a + (b * c) -> should NOT have parens because MUL > ADD
        const simple = PayloadUtils.createSymbol('BinaryExpression', {
            operator: 'ADD',
            left: PayloadUtils.createSymbol('Identifier', { name: 'a' }),
            right: PayloadUtils.createSymbol('BinaryExpression', {
                operator: 'MUL',
                left: PayloadUtils.createSymbol('Identifier', { name: 'b' }),
                right: PayloadUtils.createSymbol('Identifier', { name: 'c' })
            })
        });
        expect(FormulaRenderer.render(simple)).toBe('a + b \\cdot c');
    });

    it('should render calculus symbols correctly', () => {
        const diff = PayloadUtils.createSymbol('FunctionCall', {
            name: 'diff',
            args: [
                PayloadUtils.createSymbol('FunctionCall', {
                    name: 'sin',
                    args: [PayloadUtils.createSymbol('Identifier', { name: 'x' })]
                }),
                PayloadUtils.createSymbol('Identifier', { name: 'x' })
            ]
        });
        expect(FormulaRenderer.render(diff)).toBe('\\frac{d}{dx}\\left(\\sin{x}\\right)');

        const integral = PayloadUtils.createSymbol('FunctionCall', {
            name: 'int',
            args: [
                PayloadUtils.createSymbol('BinaryExpression', {
                    operator: 'POW',
                    left: PayloadUtils.createSymbol('Identifier', { name: 'x' }),
                    right: PayloadUtils.createSymbol('Literal', { value: 2 })
                }),
                PayloadUtils.createSymbol('Identifier', { name: 'x' })
            ]
        });
        expect(FormulaRenderer.render(integral)).toBe('\\int {x}^{2} \\, dx');
    });

    it('should render arrays correctly', () => {
        const mat = PayloadUtils.createSymbol('FunctionCall', {
            name: 'array',
            args: [{
                type: 'Literal',
                value: [[1, 2], [3, 4]]
            } as any]
        });
        expect(FormulaRenderer.render(mat)).toBe('\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}');
    });
});


