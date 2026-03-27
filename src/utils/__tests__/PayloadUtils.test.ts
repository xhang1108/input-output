import { describe, it, expect } from 'vitest';
import { PayloadUtils } from '../PayloadUtils';
import { DataType, ASTNode } from '../../types/payload';

describe('PayloadUtils Symbolic Extraction', () => {
    it('should stringify BinaryExpression with POW correctly', () => {
        const symbol: ASTNode = {
            type: 'BinaryExpression',
            operator: 'POW',
            left: { type: 'Literal', value: 2 },
            right: { type: 'Literal', value: 29 }
        };
        const result = PayloadUtils.stringifySymbol(symbol);
        expect(result).toBe('(2 ^ 29)');
    });

    it('should extract formula string from a Scalar with Complex Symbol', () => {
        const payload = {
            type: DataType.Scalar,
            value: 536870912,
            symbol: {
                type: 'BinaryExpression',
                operator: 'POW',
                left: { type: 'Literal', value: 2 },
                right: { type: 'Literal', value: 29 }
            },
            meta: {}
        };
        const result = PayloadUtils.extractExprStr(payload as any);
        expect(result).toBe('(2 ^ 29)');
    });

    it('should extract formula string from a Literal Symbol (Expression node case)', () => {
        const payload = {
            type: DataType.Scalar,
            value: 536870912,
            symbol: {
                type: 'Literal',
                value: '536870912'
            },
            meta: {}
        };
        const result = PayloadUtils.extractExprStr(payload as any);
        expect(result).toBe('536870912');
    });

    it('should handle MOD operator', () => {
        const symbol: ASTNode = {
            type: 'BinaryExpression',
            operator: 'MOD',
            left: { type: 'Identifier', name: 'x' },
            right: { type: 'Literal', value: 2 }
        };
        const result = PayloadUtils.stringifySymbol(symbol);
        expect(result).toBe('mod(x, 2)');
    });

    it('should handle Unary NEG correctly', () => {
        const symbol: ASTNode = {
            type: 'UnaryExpression',
            operator: 'NEG',
            argument: { type: 'Literal', value: 512 }
        };
        const result = PayloadUtils.stringifySymbol(symbol);
        expect(result).toBe('-512');
    });

    it('should handle mis-categorized Binary NEG correctly (fallback)', () => {
        const symbol: ASTNode = {
            type: 'BinaryExpression',
            operator: 'NEG',
            left: { type: 'Literal', value: 512 },
            right: { type: 'Literal', value: 0 }
        };
        const result = PayloadUtils.stringifySymbol(symbol);
        expect(result).toBe('(-512)');
    });

    it('should expand Input Node Identifiers with dehydrated BigNumbers', () => {
        const symbol: any = {
            type: 'Identifier',
            name: 'Number',
            value: { mathjs: 'BigNumber', value: '536870912' },
            sourceId: 'IN-01_abcd'
        };
        const result = PayloadUtils.stringifySymbol(symbol);
        expect(result).toBe('536870912');
    });

    it('should handle Factorial as function call', () => {
        const symbol: any = {
            type: 'UnaryExpression',
            operator: 'NEG',
            argument: {
                type: 'UnaryExpression',
                operator: 'FACT',
                argument: { type: 'Literal', value: 5 }
            }
        };
        const result = PayloadUtils.stringifySymbol(symbol);
        expect(result).toBe('-factorial(5)');
    });
});
