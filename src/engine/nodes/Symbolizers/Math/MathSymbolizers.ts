import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { NodeSymbolizer } from '../../../NodeRegistry';

export const MathSymbolizers: Record<string, NodeSymbolizer> = {
    'MA-01': (node, inputs) => {
        const op = ((node.data || {}) as any).op || 'ADD';
        const unaryOps = ['SIN', 'COS', 'TAN', 'SQRT', 'ABS'];
        if (unaryOps.includes(op)) {
            return PayloadUtils.createSymbol('FunctionCall', {
                name: op.toLowerCase(),
                args: [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 })]
            });
        }
        return PayloadUtils.createSymbol('BinaryExpression', {
            operator: op,
            left: inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
            right: inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 })
        });
    },
    'MA-02': (node, inputs) => (MathSymbolizers as any)['MA-01'](node, inputs),
    'MA-05': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'ROUND';

        let funcName = 'round';
        if (op === 'FLOOR') funcName = 'floor';
        else if (op === 'CEIL') funcName = 'ceil';
        else if (op === 'TRUNC') funcName = 'fix';

        const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 })];

        if (op === 'ROUND') {
            args.push(PayloadUtils.createSymbol('Literal', { value: data.precision ?? 0 }));
        }

        return PayloadUtils.createSymbol('FunctionCall', {
            name: funcName,
            args
        });
    },
    'MA-14': (node, inputs) => (MathSymbolizers as any)['MA-05'](node, inputs),
    'MA-06': (node, inputs) => PayloadUtils.createSymbol('FunctionCall', { name: 'fraction', args: [inputs['in_a'] || inputs['in']] }),
    'MA-12': (node, inputs) => (MathSymbolizers as any)['MA-06'](node, inputs),
    'MA-07': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'GCD';
        const funcMap: any = { GCD: 'gcd', LCM: 'lcm', MOD: 'mod', IS_PRIME: 'isPrime' };
        const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 })];
        if (op !== 'IS_PRIME') args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 }));
        return PayloadUtils.createSymbol('FunctionCall', { name: funcMap[op] || 'gcd', args });
    },
    'MA-03': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'LN';
        if (op === 'LOG10') return PayloadUtils.createSymbol('FunctionCall', { name: 'log10', args: [inputs['in_a'] || inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })] });
        if (op === 'LOGN') return PayloadUtils.createSymbol('FunctionCall', { name: 'log', args: [inputs['in_a'] || inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 }), inputs['in_b'] || inputs['base'] || PayloadUtils.createSymbol('Literal', { value: 10 })] });
        return PayloadUtils.createSymbol('FunctionCall', { name: 'log', args: [inputs['in_a'] || inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })] });
    },
    'MA-04': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'SIN';
        return PayloadUtils.createSymbol('FunctionCall', { name: op.toLowerCase(), args: [inputs['in_a'] || inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })] });
    },
    'MA-17': (node, inputs) => (MathSymbolizers as any)['MA-04'](node, inputs),
    // TR-06: Statistics
    'TR-06': (node, inputs) => {
        const op = ((node.data || {}) as any).op || 'Mean';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: op.toLowerCase(),
            args: [inputs['in_a'] || inputs['in'] || PayloadUtils.createSymbol('Literal', { value: '[]' })]
        });
    },
    // TR-05: Smoothing
    'TR-05': (node, inputs) => {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'smooth',
            args: [inputs['in_a'] || inputs['in'] || PayloadUtils.createSymbol('Literal', { value: '[]' })]
        });
    },
    // MA-08: Combinatorics
    'MA-08': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'nCr';
        const funcMap: any = { nCr: 'nCr', nPr: 'nPr' };
        return PayloadUtils.createSymbol('FunctionCall', {
            name: funcMap[op] || 'nCr',
            args: [
                inputs['in_n'] || PayloadUtils.createSymbol('Literal', { value: 'n' }),
                inputs['in_r'] || PayloadUtils.createSymbol('Literal', { value: 'r' })
            ]
        });
    },
    // TR-01: Unit
    'TR-01': (node, inputs) => {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'unit',
            args: [inputs['in_a'] || inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })]
        });
    },
    // TR-02: Base Converter
    'TR-02': (node, inputs) => {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'base',
            args: [inputs['in_a'] || inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })]
        });
    }
};
