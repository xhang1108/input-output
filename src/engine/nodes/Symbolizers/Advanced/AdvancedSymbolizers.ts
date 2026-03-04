import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { NodeSymbolizer } from '../../../NodeRegistry';

export const AdvancedSymbolizers: Record<string, NodeSymbolizer> = {
    // AD-01: Matrix Tools
    'AD-01': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'INV';
        const funcMap: any = { INV: 'inv', DET: 'det', TRANSPOSE: 'transpose', TRACE: 'trace', EIGEN: 'eigs', LUP: 'lup', QR: 'qr' };
        return PayloadUtils.createSymbol('FunctionCall', {
            name: funcMap[op] || 'inv',
            args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 'Matrix' })]
        });
    },

    // AD-02: Vector Utils
    'AD-02': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'DOT';
        const funcMap: any = { DOT: 'dot', CROSS: 'cross', NORM: 'norm', DISTANCE: 'distance' };
        const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 'a' })];
        if (op !== 'NORM') args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 'b' }));
        return PayloadUtils.createSymbol('FunctionCall', { name: funcMap[op] || 'dot', args });
    },

    // AD-03: Combinatorics
    'AD-03': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'nCr';
        const funcMap: any = { 'nCr': 'combinations', 'nPr': 'permutations', 'n!': 'factorial' };
        const args = [inputs['n'] || PayloadUtils.createSymbol('Literal', { value: 'n' })];
        if (op !== 'n!') args.push(inputs['r'] || PayloadUtils.createSymbol('Literal', { value: 'r' }));
        return PayloadUtils.createSymbol('FunctionCall', { name: funcMap[op] || 'combinations', args });
    },

    // AD-04: Derivative
    'AD-04': (node, inputs) => {
        const variable = ((node.data || {}) as any).variable || 'x';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: `\\frac{d}{d${variable}}`,
            args: [inputs['expr'] || PayloadUtils.createSymbol('Literal', { value: 'f(x)' })]
        });
    },

    // AD-05: Integral
    'AD-05': (node, inputs) => {
        const variable = ((node.data || {}) as any).variable || 'x';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: `\\int d${variable}`,
            args: [inputs['expr'] || PayloadUtils.createSymbol('Literal', { value: 'f(x)' })]
        });
    },

    // AD-06: Solver
    'AD-06': (node, inputs) => {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'solve',
            args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: '0' })]
        });
    },


    // AD-08: Vector Field
    'AD-08': (node, inputs) => {
        const data = (node.data || {}) as any, mode = data.mode || 'gradient';
        const inSym = inputs['in_f'] || PayloadUtils.createSymbol('Literal', { value: 'f' });
        if (mode === 'gradient') return PayloadUtils.createSymbol('FunctionCall', { name: '', args: [PayloadUtils.createSymbol('Identifier', { name: '\\nabla' }), inSym] });
        return PayloadUtils.createSymbol('FunctionCall', { name: 'VectorField', args: [inSym] });
    },

    // AD-09: Vector Split
    'AD-09': (node, inputs) => {
        const mode = ((node.data || {}) as any).mode || 'separate';
        if (mode === 'separate') return PayloadUtils.createSymbol('Identifier', { name: 'SplitVector' });
        return PayloadUtils.createSymbol('FunctionCall', { name: 'matrix', args: Array.isArray(inputs['in']) ? inputs['in'] : [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })] });
    },

    // AD-10: Geometry
    'AD-10': (node, inputs) => {
        const shape = ((node.data || {}) as any).shape || 'Circle';
        const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 })];
        if (shape !== 'Circle') args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 }));
        return PayloadUtils.createSymbol('FunctionCall', { name: shape.toLowerCase(), args });
    },

    // AD-11: Limit
    'AD-11': (node, inputs) => {
        const data = (node.data || {}) as any, variable = data.variable || 'x', approach = data.approach || '0';
        return PayloadUtils.createSymbol('FunctionCall', { name: `\\lim_{${variable}\\to ${approach}}`, args: [inputs['expr'] || PayloadUtils.createSymbol('Literal', { value: '?' })] });
    },

    // SY-05: Expert Node
    'SY-05': (node, inputs) => {
        const code = ((node.data || {}) as any).code || '';
        return PayloadUtils.createSymbol('Literal', { value: code || 'Expert' });
    }
};
