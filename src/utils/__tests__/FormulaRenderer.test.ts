import { describe, it, expect } from 'vitest';
import { FormulaRenderer } from '../FormulaRenderer';
import { PayloadUtils } from '../PayloadUtils';

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
});
