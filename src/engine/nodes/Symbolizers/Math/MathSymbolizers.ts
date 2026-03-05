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
    'MA-02': (node, inputs) => MathSymbolizers['MA-01'](node, inputs),
    'MA-03': (node) => PayloadUtils.createSymbol('Identifier', { name: ((node.data || {}) as any).val || 'pi' }),
    'MA-05': (node, inputs) => {
        const data = (node.data || {}) as any;
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'round',
            args: [
                inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
                PayloadUtils.createSymbol('Literal', { value: data.precision ?? 0 })
            ]
        });
    },
    'MA-14': (node, inputs) => MathSymbolizers['MA-05'](node, inputs),
    'MA-06': (node, inputs) => PayloadUtils.createSymbol('FunctionCall', { name: 'fraction', args: [inputs['in']] }),
    'MA-12': (node, inputs) => MathSymbolizers['MA-06'](node, inputs),
    'MA-07': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'GCD';
        const funcMap: any = { GCD: 'gcd', LCM: 'lcm', MOD: 'mod', IS_PRIME: 'isPrime' };
        const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 })];
        if (op !== 'IS_PRIME') args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 }));
        return PayloadUtils.createSymbol('FunctionCall', { name: funcMap[op] || 'gcd', args });
    },
    'MA-16': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'LN';
        if (op === 'LOG10') return PayloadUtils.createSymbol('FunctionCall', { name: 'log10', args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })] });
        if (op === 'LOG_N') return PayloadUtils.createSymbol('FunctionCall', { name: 'log', args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 }), inputs['base'] || PayloadUtils.createSymbol('Literal', { value: 10 })] });
        return PayloadUtils.createSymbol('FunctionCall', { name: 'log', args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })] });
    },
    'MA-04': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'SIN';
        return PayloadUtils.createSymbol('FunctionCall', { name: op.toLowerCase(), args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })] });
    },
    'MA-17': (node, inputs) => MathSymbolizers['MA-04'](node, inputs),
    // DA-01: Statistics
    'DA-01': (node, inputs) => {
        const op = ((node.data || {}) as any).op || 'Mean';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: op.toLowerCase(),
            args: [inputs['data'] || PayloadUtils.createSymbol('Literal', { value: '[]' })]
        });
    },
    // DA-02: Smoothing
    'DA-02': (node, inputs) => {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'smooth',
            args: [inputs['data'] || PayloadUtils.createSymbol('Literal', { value: '[]' })]
        });
    },
    // DA-03: List Utility
    'DA-03': (node, inputs) => {
        const mode = ((node.data || {}) as any).mode || 'Sort (Asc)';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: mode.toLowerCase().replace(' ', '_'),
            args: [inputs['data'] || PayloadUtils.createSymbol('Literal', { value: '[]' })]
        });
    },
    // DA-04: Set Operations
    'DA-04': (node, inputs) => {
        const mode = ((node.data || {}) as any).mode || 'Union';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: mode.toLowerCase(),
            args: [
                inputs['a'] || PayloadUtils.createSymbol('Literal', { value: 'A' }),
                inputs['b'] || PayloadUtils.createSymbol('Literal', { value: 'B' })
            ]
        });
    },
    // DA-05: Distributions
    'DA-05': (node, inputs) => {
        const mode = ((node.data || {}) as any).mode || 'Normal';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: `rand_${mode.toLowerCase()}`,
            args: [inputs['param_n'] || PayloadUtils.createSymbol('Literal', { value: 100 })]
        });
    },
    // DA-06: Array Extract
    'DA-06': (node, inputs) => {
        return PayloadUtils.createSymbol('BinaryExpression', {
            operator: 'INDEX',
            left: inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 'arr' }),
            right: inputs['index'] || PayloadUtils.createSymbol('Literal', { value: 0 })
        });
    },
    // DA-07: Array Builder
    'DA-07': (node, inputs) => {
        const args = Object.keys(inputs).sort().map(k => inputs[k]);
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'concat',
            args: args.length > 0 ? args : [PayloadUtils.createSymbol('Literal', { value: '...' })]
        });
    },
    // SY-04: ODE Solver
    'SY-04': (node, inputs) => {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'odeSolve',
            args: [inputs['expr'] || PayloadUtils.createSymbol('Literal', { value: 'y\'' })]
        });
    }
};
