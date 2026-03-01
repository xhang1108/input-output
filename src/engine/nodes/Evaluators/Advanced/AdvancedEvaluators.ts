import { DataType, NodePayload } from '../../../../types/payload';
import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { NodeEvaluator } from '../../../NodeRegistry';
import { InputOutputEngine } from '../../../InputOutputEngine';
import { NerdamerService } from '../../../calculus/NerdamerService';
import { RuntimeGuard } from '../../../calculus/RuntimeGuard';

/**
 * Helper: Extract expression string from an input payload.
 */
function extractExprStr(payload: NodePayload | undefined): string | null {
    if (!payload) return null;
    const raw = PayloadUtils.unwrap(payload);
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'number') return String(raw);
    if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
        return String((raw as Record<string, unknown>).value);
    }
    return String(raw);
}

export const AdvancedEvaluators: Record<string, NodeEvaluator> = {
    // AD-01: Matrix Tools
    'AD-01': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
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
                        subValue = math.transpose(subValue.map((item: any) => (item.vector as any)?.toArray ? (item.vector as any).toArray() : item.vector));
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
    },

    // AD-02: Vector Utils
    'AD-02': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
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
    },

    // AD-03: Combinatorics
    'AD-03': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
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
    },

    // AD-04: Derivative
    'AD-04': (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', order = Number(data.order) || 1;
        const exprStr = extractExprStr(inputs['expr']);
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createSymbolic('0');
        try {
            const result = RuntimeGuard.safeEvaluate(() => NerdamerService.getInstance().differentiate(exprStr, variable, order));
            if (!result.ok) return PayloadUtils.createError(result.error || 'Differentiation Failed');
            return PayloadUtils.createSymbolic(result.value.text());
        } catch (e: any) { return PayloadUtils.createError(`Diff Failed: ${e.message}`); }
    },

    // AD-05: Integral
    'AD-05': (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', mode = data.mode || 'indefinite', lower = data.lower || '', upper = data.upper || '';
        const exprStr = extractExprStr(inputs['expr']);
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
    },

    // AD-06: Solver
    'AD-06': (node, inputs) => {
        const equations: string[] = [];
        const inPayload = inputs['in'];
        if (inPayload) {
            const processPayload = (p: any) => {
                const val = PayloadUtils.unwrap(p);
                if (val && typeof val === 'object' && 'toArray' in (val as any)) {
                    (val as any).toArray().flat(Infinity).forEach((v: any) => equations.push(String(v)));
                } else if (Array.isArray(val)) {
                    val.flat(Infinity).forEach(v => {
                        if (typeof v === 'object' && v !== null && 'value' in v) equations.push(String((v as any).value));
                        else equations.push(String(v));
                    });
                } else if (typeof val === 'string') equations.push(val);
                else {
                    const s = String(val);
                    if (s !== 'null' && s !== 'undefined') equations.push(s);
                }
            };
            if (Array.isArray(inPayload)) inPayload.forEach(processPayload);
            else processPayload(inPayload);
        }

        if (equations.length === 0) return PayloadUtils.createError('No Equation Input');
        try {
            const nerdamer = require('nerdamer/all');
            const solveFor = (node.data?.solveFor as string) || '';
            let solutions;
            if (equations.length === 1) {
                solutions = solveFor.trim() ? nerdamer(equations[0]).solveFor(solveFor.trim()) : nerdamer.solveEquations(equations[0]);
            } else {
                solutions = nerdamer.solveEquations(equations);
                if (solveFor.trim() && Array.isArray(solutions)) {
                    const targetSol = (solutions as any).find((s: any) => Array.isArray(s) && s[0] === solveFor.trim());
                    if (targetSol && targetSol.length > 1) solutions = [targetSol[1]];
                }
            }

            let outStr = '';
            if (Array.isArray(solutions)) {
                const mappedValues = (solutions as any).map((s: any) => {
                    try {
                        if (Array.isArray(s)) return `[${s.map(ss => nerdamer(ss).text('decimals')).join(', ')}]`;
                        return nerdamer(s).text('decimals');
                    } catch { return String(s); }
                });
                outStr = `[${mappedValues.join(', ')}]`;
            } else outStr = String(solutions);

            return PayloadUtils.createSymbolic(outStr);
        } catch (e: any) { return PayloadUtils.createError(`Solve Failed: ${e.message}`); }
    },

    // AD-07: Complex Math
    'AD-07': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as Record<string, unknown>;
        const mode = data.mode as string || 'separate';
        try {
            if (mode === 'separate') {
                const valPayload = inputs['in'];
                if (!valPayload) return PayloadUtils.createError('No Input');
                const val = PayloadUtils.hydrate(valPayload.value, math);
                const re = math.re(val), im = math.im(val), abs = math.abs(val);
                const arg = typeof math.arg === 'function' ? math.arg(val) : 0;
                return {
                    type: DataType.Object,
                    value: {
                        're': PayloadUtils.createScalar(PayloadUtils.dehydrate(re)),
                        'im': PayloadUtils.createScalar(PayloadUtils.dehydrate(im)),
                        'abs': PayloadUtils.createScalar(PayloadUtils.dehydrate(abs)),
                        'arg': PayloadUtils.createScalar(PayloadUtils.dehydrate(arg))
                    },
                    symbol: null,
                    meta: { unit: valPayload.meta?.unit }
                };
            } else if (mode === 'combine_cartesian') {
                const re = PayloadUtils.hydrate(inputs['in_re']?.value || 0, math);
                const im = PayloadUtils.hydrate(inputs['in_im']?.value || 0, math);
                return PayloadUtils.createScalar(PayloadUtils.dehydrate(math.complex(Number(re), Number(im))));
            } else if (mode === 'combine_polar') {
                const r = PayloadUtils.hydrate(inputs['in_abs']?.value || 0, math);
                const phi = PayloadUtils.hydrate(inputs['in_arg']?.value || 0, math);
                return PayloadUtils.createScalar(PayloadUtils.dehydrate(math.complex({ r: Number(r), phi: Number(phi) })));
            }
            return PayloadUtils.createError('Invalid Mode');
        } catch (e: any) { return PayloadUtils.createError(`Complex Failed: ${e.message}`); }
    },

    // AD-08: Vector Field
    'AD-08': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const mode = data.mode || 'gradient', var1 = data.var1 || 'x', var2 = data.var2 || 'y';
        const min = Number(data.min ?? -5), max = Number(data.max ?? 5), density = Number(data.density ?? 10);
        const inPayload = inputs['in_f'];
        if (!inPayload) return PayloadUtils.createError('No input');
        try {
            const exprVal = PayloadUtils.unwrap(inPayload);
            let uExpr: any, vExpr: any, outGrad: any = null;
            if (mode === 'gradient') {
                const nodeExpr = typeof exprVal === 'string' ? math.parse(exprVal) : exprVal;
                uExpr = math.derivative(nodeExpr, var1);
                vExpr = math.derivative(nodeExpr, var2);
                outGrad = { type: DataType.Vector, value: [uExpr.toString(), vExpr.toString()], symbol: null, meta: {} };
            } else {
                const hydrated = PayloadUtils.hydrate(exprVal, math);
                const arr = (hydrated?.toArray ? hydrated.toArray() : Array.isArray(hydrated) ? hydrated : []).flat(Infinity);
                if (arr.length < 2) return PayloadUtils.createError('Requires 2D vector [u, v]');
                uExpr = typeof arr[0] === 'string' ? math.parse(arr[0]) : math.parse(String(arr[0]));
                vExpr = typeof arr[1] === 'string' ? math.parse(arr[1]) : math.parse(String(arr[1]));
            }
            const uCode = uExpr.compile(), vCode = vExpr.compile(), step = (max - min) / Math.max(1, density - 1), fieldData: number[][] = [];
            for (let i = 0; i < density; i++) {
                const y = min + i * step;
                for (let j = 0; j < density; j++) {
                    const x = min + j * step;
                    const scope = { [var1]: x, [var2]: y };
                    try { fieldData.push([x, y, Number(uCode.evaluate(scope)) || 0, Number(vCode.evaluate(scope)) || 0]); }
                    catch { fieldData.push([x, y, 0, 0]); }
                }
            }
            const result: any = { 'out_field': { type: DataType.Matrix, value: fieldData, symbol: null, meta: { unit: inPayload.meta?.unit } } };
            if (outGrad) result['out_grad'] = outGrad;
            return { type: DataType.Object, value: result, symbol: null, meta: {} };
        } catch (e: any) { return PayloadUtils.createError(`VectorField Failed: ${e.message}`); }
    },

    // AD-09: Vector Split
    'AD-09': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any, mode = data.mode || 'separate';
        if (mode === 'separate') {
            const valPayload = inputs['in'] || Object.values(inputs)[0];
            if (!valPayload) return PayloadUtils.createError('No Input');
            const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
            const arr = (hydrated?.toArray ? hydrated.toArray() : Array.isArray(hydrated) ? hydrated : [hydrated]).flat(Infinity);
            return {
                type: DataType.Object,
                value: { x: PayloadUtils.wrap(arr[0] ?? 0), y: PayloadUtils.wrap(arr[1] ?? 0), z: PayloadUtils.wrap(arr[2] ?? 0) },
                symbol: null,
                meta: { handleMeta: { x: { unit: valPayload.meta?.unit }, y: { unit: valPayload.meta?.unit }, z: { unit: valPayload.meta?.unit } } }
            };
        } else {
            let items: any[] = [];
            const inPayload = inputs['in'];
            if (inPayload) {
                const process = (p: any) => {
                    const h = PayloadUtils.hydrate(PayloadUtils.unwrap(p), math);
                    if (h?.toArray) items.push(...h.toArray().flat(Infinity));
                    else if (Array.isArray(h)) items.push(...h.flat(Infinity));
                    else items.push(h);
                };
                if (Array.isArray(inPayload)) inPayload.forEach(process); else process(inPayload);
            } else {
                items = [PayloadUtils.unwrap(inputs['x']) || 0, PayloadUtils.unwrap(inputs['y']) || 0, PayloadUtils.unwrap(inputs['z']) || 0];
            }
            const mat = math.matrix(items.length ? items : [0, 0, 0]);
            return { type: DataType.Matrix, value: PayloadUtils.dehydrate(mat), symbol: null, meta: { unit: (inputs['in'] as any)?.meta?.unit } };
        }
    },

    // AD-10: Geometry
    'AD-10': (node, inputs) => {
        const data = (node.data || {}) as any, shape = data.shape || 'Circle';
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const getNum = (key: string) => {
            const val = PayloadUtils.hydrate(PayloadUtils.unwrap(inputs[key]), math);
            return typeof val === 'number' ? val : (val?.toNumber ? val.toNumber() : Number(val) || 0);
        };
        let area = 0, perimeter = 0;
        if (shape === 'Circle') {
            const r = getNum('in_a');
            area = Math.PI * r * r; perimeter = 2 * Math.PI * r;
        } else if (shape === 'Quad') {
            const w = getNum('in_a'), h = getNum('in_b');
            area = w * h; perimeter = 2 * (w + h);
        } else if (shape === 'Triangle') {
            const b = getNum('in_a'), h = getNum('in_b');
            area = 0.5 * b * h; perimeter = b + h + Math.sqrt(b * b + h * h);
        }
        return {
            type: DataType.Object,
            value: { area: PayloadUtils.wrap(area), perimeter: PayloadUtils.wrap(perimeter), volume: PayloadUtils.wrap(0) },
            symbol: null, meta: {}
        };
    },

    // AD-11: Limit
    'AD-11': (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', approach = data.approach || '0', direction = data.direction || 'both';
        const exprStr = extractExprStr(inputs['expr']);
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createError('No Expression Input');
        try {
            const svc = NerdamerService.getInstance();
            const result = RuntimeGuard.safeEvaluate(() => svc.limit(exprStr, variable, approach));
            if (result.ok) {
                const text = result.value.text('decimals'), num = Number(text);
                if (!isNaN(num) && isFinite(num)) {
                    if (direction === 'both' && !isNaN(Number(approach))) {
                        const compiled = svc.compileToFunction(exprStr, [variable]);
                        const a = Number(approach);
                        if (Math.abs(Number(compiled({ [variable]: a - 1e-8 })) - Number(compiled({ [variable]: a + 1e-8 }))) > 0.01) return PayloadUtils.createError('Limit DNE');
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
    },

    // SY-05: Expert Node
    'SY-05': (node, inputs) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const code = (data.code as string) || '';
        if (!code) return PayloadUtils.createScalar(0);
        const math = InputOutputEngine.getInstance().getMathInstance();
        try {
            const scope: Record<string, any> = {};
            for (const [key, val] of Object.entries(inputs)) scope[key] = PayloadUtils.hydrate(PayloadUtils.unwrap(val), math);
            const result = math.evaluate(code, scope);
            return { type: DataType.Scalar, value: PayloadUtils.dehydrate(result), symbol: null, meta: {} };
        } catch (error) { return PayloadUtils.createError(String(error)); }
    }
};
