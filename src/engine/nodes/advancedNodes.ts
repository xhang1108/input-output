import { CalctopusEngine } from '../CalctopusEngine';
import { DataType } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NodeRegistry } from '../NodeRegistry';
import { NerdamerService } from '../calculus/NerdamerService';
import { RuntimeGuard } from '../calculus/RuntimeGuard';

export function registerAdvancedNodes() {
    // AD-01: Matrix Tools
    NodeRegistry.register('AD-01', (node, inputs) => {
        const math = CalctopusEngine.getInstance().getMathInstance() as any;
        const valPayload = inputs['in'];
        if (!valPayload) return PayloadUtils.createError('No Input');
        const data = (node.data || {}) as any;
        const op = data.op || 'INV';
        const val = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        try {
            let result: any;
            if (op === 'INV') result = math.inv(val);
            else if (op === 'DET') result = math.det(val);
            else if (op === 'TRANSPOSE') result = math.transpose(val);
            else if (op === 'TRACE') result = math.trace(val);
            else if (op === 'EIGEN') result = math.eigs(val);
            else if (op === 'LUP') result = math.lup(val);
            else if (op === 'QR') result = math.qr(val);
            else result = val;

            if (['QR', 'LUP', 'EIGEN'].includes(op)) {
                const outMap: any = { QR: ['Q', 'R'], LUP: ['L', 'U', 'p'], EIGEN: ['values', 'eigenvectors'] };
                const multiValue: any = {};
                const handleMeta: any = {};
                for (const key of outMap[op]) {
                    const handleKey = key === 'p' ? 'P' : (key === 'eigenvectors' ? 'vectors' : key);
                    let subValue = result[key];
                    if (key === 'eigenvectors' && Array.isArray(subValue)) {
                        subValue = math.transpose(subValue.map((item: any) => item.vector?.toArray ? item.vector.toArray() : item.vector));
                    }
                    const matPayload = PayloadUtils.createMatrix(PayloadUtils.dehydrate(subValue) as any);
                    matPayload.meta.unit = valPayload.meta?.unit;
                    multiValue[handleKey] = matPayload;
                    handleMeta[handleKey] = { unit: valPayload.meta?.unit };
                }
                return { type: DataType.Object, value: multiValue, symbol: null, meta: { handleMeta } };
            }
            return { type: (Array.isArray(result) || (result as any)?.isMatrix) ? DataType.Matrix : DataType.Scalar, value: PayloadUtils.dehydrate(result), symbol: null, meta: { unit: valPayload.meta?.unit } };
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    }, (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'INV';
        const funcMap: any = { INV: 'inv', DET: 'det', TRANSPOSE: 'transpose', TRACE: 'trace', EIGEN: 'eigs', LUP: 'lup', QR: 'qr' };
        return PayloadUtils.createSymbol('FunctionCall', { name: funcMap[op] || 'inv', args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 'Matrix' })] });
    });

    // AD-02: Vector Utils
    NodeRegistry.register('AD-02', (node, inputs) => {
        const math = CalctopusEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'DOT';
        const getVal = (key: string) => {
            const p = inputs[key];
            if (!p) return null;
            const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(p), math) as any;
            return (hydrated?.isMatrix || Array.isArray(hydrated)) ? math.flatten(hydrated) : hydrated;
        };
        const valA = getVal('in_a'), valB = getVal('in_b');
        try {
            let result;
            if (op === 'DOT') result = math.dot(valA, valB);
            else if (op === 'CROSS') result = math.cross(valA, valB);
            else if (op === 'NORM') result = math.norm(valA);
            else if (op === 'DISTANCE') result = math.distance(valA, valB);
            else result = 0;
            return { type: (Array.isArray(result) || result?.isMatrix) ? DataType.Matrix : DataType.Scalar, value: PayloadUtils.dehydrate(result), symbol: null, meta: { unit: inputs['in_a']?.meta?.unit } };
        } catch (e) { return PayloadUtils.createError(`${op} Failed`); }
    }, (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'DOT';
        const funcMap: any = { DOT: 'dot', CROSS: 'cross', NORM: 'norm', DISTANCE: 'distance' };
        const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 'a' })];
        if (op !== 'NORM') args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 'b' }));
        return PayloadUtils.createSymbol('FunctionCall', { name: funcMap[op] || 'dot', args });
    });

    // AD-03: Combinatorics
    NodeRegistry.register('AD-03', (node, inputs) => {
        const math = CalctopusEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'nCr';
        const getVal = (key: string) => {
            const p = inputs[key];
            if (!p) return 0;
            let v = PayloadUtils.unwrap(p);
            if (Array.isArray(v) && v.length > 0) v = v[0];
            const hydrated = PayloadUtils.hydrate(v, math) as any;
            return typeof hydrated === 'number' ? hydrated : (hydrated?.toNumber ? hydrated.toNumber() : Number(hydrated) || 0);
        };
        const n = getVal('n'), r = getVal('r');
        try {
            let result;
            if (op === 'nCr') result = math.combinations(n, r);
            else if (op === 'nPr') result = math.permutations(n, r);
            else if (op === 'n!') result = math.factorial(n);
            else result = 0;
            return PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    }, (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'nCr';
        const funcMap: any = { 'nCr': 'combinations', 'nPr': 'permutations', 'n!': 'factorial' };
        const args = [inputs['n'] || PayloadUtils.createSymbol('Literal', { value: 'n' })];
        if (op !== 'n!') args.push(inputs['r'] || PayloadUtils.createSymbol('Literal', { value: 'r' }));
        return PayloadUtils.createSymbol('FunctionCall', { name: funcMap[op] || 'combinations', args });
    });

    // AD-04: Derivative
    NodeRegistry.register('AD-04', (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', order = Number(data.order) || 1;
        const exprPayload = inputs['expr'];
        if (!exprPayload) return PayloadUtils.createError('No Expression Input');
        const exprStr = String(PayloadUtils.unwrap(exprPayload));
        if (!exprStr || ['0', 'null', 'undefined'].includes(exprStr)) return PayloadUtils.createSymbolic('0');
        try {
            const result = RuntimeGuard.safeEvaluate(() => NerdamerService.getInstance().differentiate(exprStr, variable, order));
            if (!result.ok) return PayloadUtils.createError(result.error || 'Differentiation Failed');
            return PayloadUtils.createSymbolic(result.value.text());
        } catch (e: any) { return PayloadUtils.createError(`Diff Failed: ${e.message}`); }
    }, (node, inputs) => {
        const variable = ((node.data || {}) as any).variable || 'x';
        return PayloadUtils.createSymbol('FunctionCall', { name: `\\frac{d}{d${variable}}`, args: [inputs['expr'] || PayloadUtils.createSymbol('Literal', { value: 'f(x)' })] });
    });

    // AD-05: Integral
    NodeRegistry.register('AD-05', (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', mode = data.mode || 'indefinite', lower = data.lower || '', upper = data.upper || '';
        const exprPayload = inputs['expr'];
        if (!exprPayload) return PayloadUtils.createError('No Expression Input');
        const exprStr = String(PayloadUtils.unwrap(exprPayload));
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createSymbolic('0');
        try {
            const svc = NerdamerService.getInstance();
            if (mode === 'definite' && lower && upper) {
                const result = RuntimeGuard.safeEvaluate(() => {
                    try { return svc.definiteIntegral(exprStr, variable, lower, upper); }
                    catch {
                        const a = Number(lower), b = Number(upper);
                        if (isNaN(a) || isNaN(b)) throw new Error('Bounds must be numeric');
                        const compiled = svc.compileToFunction(exprStr, [variable]);
                        const n = 100, h = (b - a) / n;
                        let sum = Number(compiled({ [variable]: a })) + Number(compiled({ [variable]: b }));
                        for (let i = 1; i < n; i++) sum += (i % 2 === 0 ? 2 : 4) * Number(compiled({ [variable]: a + i * h }));
                        return { text: () => String(sum * h / 3) };
                    }
                });
                if (!result.ok) return PayloadUtils.createError(result.error || 'Integration Failed');
                const text = result.value.text('decimals'), num = Number(text);
                return !isNaN(num) ? PayloadUtils.createScalar(num) : PayloadUtils.createSymbolic(text);
            } else {
                const result = RuntimeGuard.safeEvaluate(() => svc.integrate(exprStr, variable));
                if (!result.ok) return PayloadUtils.createError(result.error || 'Integration Failed');
                return PayloadUtils.createSymbolic(result.value.text());
            }
        } catch (e: any) { return PayloadUtils.createError(`Integral Failed: ${e.message}`); }
    }, (node, inputs) => {
        const variable = ((node.data || {}) as any).variable || 'x';
        return PayloadUtils.createSymbol('FunctionCall', { name: `\\int d${variable}`, args: [inputs['expr'] || PayloadUtils.createSymbol('Literal', { value: 'f(x)' })] });
    });

    // AD-11: Limit
    NodeRegistry.register('AD-11', (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', approach = data.approach || '0', direction = data.direction || 'both';
        const exprPayload = inputs['expr'];
        if (!exprPayload) return PayloadUtils.createError('No Expression Input');
        const exprStr = String(PayloadUtils.unwrap(exprPayload));
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createScalar(0);
        try {
            const svc = NerdamerService.getInstance();
            const result = RuntimeGuard.safeEvaluate(() => svc.limit(exprStr, variable, approach));
            if (result.ok) {
                const text = result.value.text('decimals'), num = Number(text);
                if (!isNaN(num) && isFinite(num)) {
                    if (direction !== 'right' && !isNaN(Number(approach))) {
                        const compiled = svc.compileToFunction(exprStr, [variable]);
                        const a = Number(approach);
                        if (Math.abs(Number(compiled({ [variable]: a - 1e-8 })) - Number(compiled({ [variable]: a + 1e-8 }))) > 0.01 && direction === 'both') return PayloadUtils.createError('Limit DNE: Left ≠ Right');
                    }
                    return PayloadUtils.createScalar(num);
                }
                return PayloadUtils.createSymbolic(text);
            }
            return RuntimeGuard.evaluateToPayload(() => {
                const compiled = svc.compileToFunction(exprStr, [variable]), a = Number(approach);
                return direction === 'left' ? compiled({ [variable]: a - 1e-10 }) : compiled({ [variable]: a + 1e-10 });
            }, (v) => PayloadUtils.wrap(v));
        } catch (e: any) { return PayloadUtils.createError(`Limit Failed: ${e.message}`); }
    });
}
