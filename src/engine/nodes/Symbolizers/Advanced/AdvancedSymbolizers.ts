import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { NodeSymbolizer } from '../../../NodeRegistry';
import { ASTNode } from '../../../../types/payload';

export const AdvancedSymbolizers: Record<string, NodeSymbolizer> = {
    // DT-01: Array Builder
    'DT-01': (node, inputs) => {
        const args = Object.keys(inputs).sort().map(k => inputs[k] || PayloadUtils.createSymbol('Literal', { value: '?' }));
        return PayloadUtils.createSymbol('FunctionCall', { name: 'list', args });
    },

    // DT-02: Array Extract
    'DT-02': (node, inputs) => {
        const data = (node.data || {}) as any;
        const index = data.index || 0;
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'extract',
            args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: '[]' }), PayloadUtils.createSymbol('Literal', { value: index })]
        });
    },

    // DT-03: List Utility
    'DT-03': (node, inputs) => {
        const op = ((node.data || {}) as any).op || 'SIZE';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: op.toLowerCase(),
            args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: '[]' })]
        });
    },

    // DT-04: Set Operations
    'DT-04': (node, inputs) => {
        const op = ((node.data || {}) as any).op || 'UNION';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: op.toLowerCase(),
            args: [
                inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 'A' }),
                inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 'B' })
            ]
        });
    },

    // DT-07: Matrix Tools
    'DT-07': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'INV';
        const funcMap: any = { INV: 'inv', DET: 'det', TRANSPOSE: 'transpose', TRACE: 'trace', EIGEN: 'eigs', LUP: 'lup', QR: 'qr' };
        return PayloadUtils.createSymbol('FunctionCall', {
            name: funcMap[op] || 'inv',
            args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 'Matrix' })]
        });
    },

    // DT-05: Vector Utils
    'DT-05': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'DOT';
        const funcMap: any = { DOT: 'dot', CROSS: 'cross', NORM: 'norm', DISTANCE: 'distance' };
        const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 'a' })];
        if (op !== 'NORM') args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 'b' }));
        return PayloadUtils.createSymbol('FunctionCall', { name: funcMap[op] || 'dot', args });
    },

    // MA-15: Combinatorics
    'AD-03': (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'nCr';
        const funcMap: any = { 'nCr': 'combinations', 'nPr': 'permutations', 'n!': 'factorial' };
        const args = [inputs['n'] || PayloadUtils.createSymbol('Literal', { value: 'n' })];
        if (op !== 'n!') args.push(inputs['r'] || PayloadUtils.createSymbol('Literal', { value: 'r' }));
        return PayloadUtils.createSymbol('FunctionCall', { name: funcMap[op] || 'combinations', args });
    },

    // CL-01: Derivative
    'CL-01': (node, inputs) => {
        const variable = ((node.data || {}) as any).variable || 'x';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: `\\frac{d}{d${variable}}`,
            args: [inputs['expr'] || PayloadUtils.createSymbol('Literal', { value: 'f(x)' })]
        });
    },

    // CL-02: Integral
    'CL-02': (node, inputs) => {
        const variable = ((node.data || {}) as any).variable || 'x';
        return PayloadUtils.createSymbol('FunctionCall', {
            name: `\\int d${variable}`,
            args: [inputs['expr'] || PayloadUtils.createSymbol('Literal', { value: 'f(x)' })]
        });
    },

    // CL-04: Solver
    'CL-04': (node, inputs) => {
        const args: ASTNode[] = [];
        Object.keys(inputs).sort().forEach(key => {
            const sym = inputs[key];
            if (Array.isArray(sym)) {
                args.push(...sym);
            } else if (sym) {
                args.push(sym);
            }
        });

        const data = (node.data || {}) as any;
        const variable = data.variable || data.solveFor || '';
        if (args.length === 0) args.push(PayloadUtils.createSymbol('Literal', { value: '0' }));

        return PayloadUtils.createSymbol('FunctionCall', {
            name: variable ? `solve_{${variable}}` : 'solve',
            args
        });
    },


    // TR-04: Vector Field
    'TR-04': (node, inputs) => {
        const data = (node.data || {}) as any, mode = data.mode || 'gradient';
        const inSym = inputs['in_f'] || PayloadUtils.createSymbol('Literal', { value: 'f' });
        if (mode === 'gradient') return PayloadUtils.createSymbol('FunctionCall', { name: '', args: [PayloadUtils.createSymbol('Identifier', { name: '\\nabla' }), inSym] });
        return PayloadUtils.createSymbol('FunctionCall', { name: 'VectorField', args: [inSym] });
    },

    // DT-06: Vector Split
    'DT-06': (node, inputs) => {
        const mode = ((node.data || {}) as any).mode || 'separate';
        if (mode === 'separate') return PayloadUtils.createSymbol('Identifier', { name: 'SplitVector' });
        return PayloadUtils.createSymbol('FunctionCall', { name: 'matrix', args: Array.isArray(inputs['in']) ? inputs['in'] : [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })] });
    },

    // TR-03: Geometry
    'TR-03': (node, inputs) => {
        const shape = ((node.data || {}) as any).shape || 'Circle';
        const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 })];
        if (shape !== 'Circle') args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 }));
        return PayloadUtils.createSymbol('FunctionCall', { name: shape.toLowerCase(), args });
    },

    // CL-03: Limit
    'CL-03': (node, inputs) => {
        const data = (node.data || {}) as any, variable = data.variable || 'x', approach = data.approach || '0';
        return PayloadUtils.createSymbol('FunctionCall', { name: `\\lim_{${variable}\\to ${approach}}`, args: [inputs['expr'] || PayloadUtils.createSymbol('Literal', { value: '?' })] });
    },

    // CL-05: ODE Solver
    'CL-05': (node, inputs) => {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'rk4',
            args: [inputs['expr'] || PayloadUtils.createSymbol('Literal', { value: 'f(t,y)' })]
        });
    },
    // IN-09: Expert Node (Expression)
    'IN-09': (node, inputs) => {
        const code = ((node.data || {}) as any).code || '';
        return PayloadUtils.createSymbol('Literal', { value: code || 'Expert' });
    }
};
