import { InputOutputEngine } from '../../../InputOutputEngine';
import { DataType, NodePayload } from '../../../../types/payload';
import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { NodeEvaluator } from '../../../NodeRegistry';
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
    // DT-01: Array Builder
    'DT-01': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        let items: any[] = [];

        // Support IOGL 2.0 Capsule handle 'in'
        const capsuleInput = inputs['in'];
        if (capsuleInput) {
            if (Array.isArray(capsuleInput)) {
                items = capsuleInput.map(p => PayloadUtils.hydrate(PayloadUtils.unwrap(p), math));
            } else {
                items = [PayloadUtils.hydrate(PayloadUtils.unwrap(capsuleInput), math)];
            }
        } else {
            // Fallback to in_0, in_1... for legacy
            Object.keys(inputs).sort().forEach(key => {
                if (key.startsWith('in_')) items.push(PayloadUtils.hydrate(PayloadUtils.unwrap(inputs[key]), math));
            });
        }

        return PayloadUtils.createMatrix(PayloadUtils.dehydrate(items));
    },

    // DT-02: Array Extract
    'DT-02': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const index = Number(data.index || 0);
        const inPayload = inputs['in'];
        if (!inPayload) return PayloadUtils.createError('No Input');
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(inPayload), math);
        const arr = (hydrated && typeof hydrated === 'object' && 'toArray' in hydrated ? (hydrated as any).toArray() : Array.isArray(hydrated) ? hydrated : [hydrated]).flat(Infinity);
        return PayloadUtils.createScalar(PayloadUtils.dehydrate(arr[index] ?? 0));
    },

    // DT-03: List Utility
    'DT-03': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'SIZE';
        const inPayload = inputs['in'];
        if (!inPayload) return PayloadUtils.createError('No Input');
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(inPayload), math);
        const arr = (hydrated && typeof hydrated === 'object' && 'toArray' in hydrated ? (hydrated as any).toArray() : Array.isArray(hydrated) ? hydrated : [hydrated]).flat(Infinity);
        try {
            let result: any;
            if (op === 'SIZE') result = arr.length;
            else if (op === 'SUM') result = math.sum(arr);
            else if (op === 'MEAN') result = math.mean(arr);
            else if (op === 'MAX') result = math.max(arr);
            else if (op === 'MIN') result = math.min(arr);
            else if (op === 'SORT') result = math.sort(arr);
            else result = arr.length;
            return (Array.isArray(result) || result?.isMatrix) ? PayloadUtils.createMatrix(PayloadUtils.dehydrate(result)) : PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed`); }
    },

    // DT-04: Set Operations
    'DT-04': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'UNION';
        const getArr = (key: string) => {
            const p = inputs[key];
            if (!p) return [];
            const h = PayloadUtils.hydrate(PayloadUtils.unwrap(p), math);
            return (h && typeof h === 'object' && (h as any).toArray ? (h as any).toArray() : Array.isArray(h) ? h : [h]).flat(Infinity);
        };
        const arrA = getArr('in_a'), arrB = getArr('in_b');
        try {
            let result: any[];
            if (op === 'UNION') result = Array.from(new Set([...arrA, ...arrB]));
            else if (op === 'INTERSECT') result = arrA.filter((x: any) => arrB.includes(x));
            else if (op === 'SUBTRACT') result = arrA.filter((x: any) => !arrB.includes(x));
            else result = [];
            return PayloadUtils.createMatrix(PayloadUtils.dehydrate(result));
        } catch (e) { return PayloadUtils.createError(`${op} Failed`); }
    },

    // DT-07: Matrix Tools
    'DT-07': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const valPayload = inputs['in'];
        if (!valPayload) return PayloadUtils.createError('No Input');
        const data = (node.data || {}) as any, op = data.op || 'INV';
        try {
            const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
            let result: any;
            if (op === 'INV') result = math.inv(hydrated);
            else if (op === 'DET') result = math.det(hydrated);
            else if (op === 'TRANSPOSE') result = math.transpose(hydrated);
            else if (op === 'TRACE') result = math.trace(hydrated);
            else if (op === 'EIGEN') result = math.eigs(hydrated).values;
            else if (op === 'LUP') result = math.lup(hydrated).P;
            else if (op === 'QR') result = math.qr(hydrated).Q;
            else result = hydrated;
            return (Array.isArray(result) || result?.isMatrix) ? PayloadUtils.createMatrix(PayloadUtils.dehydrate(result)) : PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    },

    // DT-05: Vector Utils
    'DT-05': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'DOT';
        const valA = inputs['in_a'], valB = inputs['in_b'];
        if (!valA || !valB) return PayloadUtils.createError('Missing Inputs');
        try {
            const hA = PayloadUtils.hydrate(PayloadUtils.unwrap(valA), math), hB = PayloadUtils.hydrate(PayloadUtils.unwrap(valB), math);
            let result: any;
            if (op === 'DOT') result = math.dot(hA, hB);
            else if (op === 'CROSS') result = math.cross(hA, hB);
            else if (op === 'NORM') result = math.norm(hA);
            else if (op === 'DISTANCE') result = math.distance(hA, hB);
            else result = math.dot(hA, hB);
            return (Array.isArray(result) || result?.isMatrix) ? PayloadUtils.createMatrix(PayloadUtils.dehydrate(result)) : PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
        } catch (e) { return PayloadUtils.createError(`${op} Failed`); }
    },

    // MA-15: Combinatorics (Mapping from registration if needed, or keeping for internal)
    'AD-03': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'nCr';
        const valN = inputs['in_n'], valR = inputs['in_r'];
        if (!valN || !valR) return PayloadUtils.createError('Missing Inputs');
        try {
            const n = PayloadUtils.unwrap(valN), r = PayloadUtils.unwrap(valR);
            let result: any;
            if (op === 'nCr') result = math.combinations(n, r);
            else if (op === 'nPr') result = math.permutations(n, r);
            else if (op === 'STIRLING2') result = math.stirlingS2(n, r);
            else if (op === 'BELL') result = math.bellNumbers(n);
            else if (op === 'CATALAN') result = math.catalan(n);
            else result = math.combinations(n, r);
            return PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    },

    // CL-01: Derivative
    'CL-01': (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', order = Number(data.order) || 1;
        const exprStr = extractExprStr(inputs['expr']);
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createError('No Expression Input');
        try {
            const svc = NerdamerService.getInstance();
            return PayloadUtils.createSymbolic(svc.differentiate(exprStr, variable, order).text());
        } catch (e: any) { return PayloadUtils.createError(`Diff Failed: ${e.message}`); }
    },

    // CL-02: Integral
    'CL-02': (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', mode = data.mode || 'indefinite', lower = data.lower || '', upper = data.upper || '';
        const exprStr = extractExprStr(inputs['expr']);
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createError('No Expression Input');
        try {
            const svc = NerdamerService.getInstance();
            if (mode === 'definite') {
                const res = RuntimeGuard.safeEvaluate(() => svc.definiteIntegral(exprStr, variable, lower, upper));
                if (res.ok) {
                    const text = (res.value as any).text('decimals');
                    const num = Number(text);
                    return (!isNaN(num) && isFinite(num)) ? PayloadUtils.createScalar(num) : PayloadUtils.createSymbolic(text);
                }
                return PayloadUtils.createError(res.error || 'Integral Failed');
            }
            return PayloadUtils.createSymbolic(svc.integrate(exprStr, variable).text());
        } catch (e: any) { return PayloadUtils.createError(`Integral Failed: ${e.message}`); }
    },

    // CL-04: Solver
    'CL-04': (node, inputs) => {
        const equations: string[] = [];
        const inPayload = inputs['in'];
        if (inPayload) {
            const raw = PayloadUtils.unwrap(inPayload);
            if (Array.isArray(raw)) equations.push(...raw.map(String));
            else if (typeof raw === 'string') equations.push(...raw.split(',').map((s: string) => s.trim()));
            else equations.push(String(raw));
        }
        if (equations.length === 0) return PayloadUtils.createError('No Equations');
        try {
            const svc = NerdamerService.getInstance();
            const textResult = svc.evaluate(`solve(${equations.join(',')}, x)`);

            // Handle array results [1, 2, 3] or single value
            if (textResult.startsWith('[') && textResult.endsWith(']')) {
                try {
                    // Try parsing as simple numeric array
                    const parsed = JSON.parse(textResult.replace(/Math\./g, ''));
                    return PayloadUtils.createMatrix(parsed);
                } catch (e) {
                    // Fallback: split by comma if JSON parse fails (nerdamer specific format)
                    const elements = textResult.slice(1, -1).split(',').map((s: string) => s.trim());
                    return PayloadUtils.createMatrix(elements);
                }
            }
            return PayloadUtils.createMatrix([textResult]);
        } catch (e: any) { return PayloadUtils.createError(`Solve Failed: ${e.message}`); }
    },


    // TR-04: Vector Field
    'TR-04': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const mode = data.mode || 'gradient', var1 = data.var1 || 'x', var2 = data.var2 || 'y';
        const exprStr = extractExprStr(inputs['in_f']);
        if (!exprStr) return PayloadUtils.createError('No Function Input');
        try {
            const svc = NerdamerService.getInstance();
            if (mode === 'gradient') {
                const dx = svc.differentiate(exprStr, var1).text(), dy = svc.differentiate(exprStr, var2).text();
                return PayloadUtils.createMatrix([dx, dy]);
            }
            if (mode === 'divergence') {
                const p = extractExprStr(inputs['in_p']), q = extractExprStr(inputs['in_q']);
                if (!p || !q) return PayloadUtils.createError('Missing P/Q components');
                const dp = svc.differentiate(p, var1).text(), dq = svc.differentiate(q, var2).text();
                return PayloadUtils.createSymbolic(`(${dp})+(${dq})`);
            }
            if (mode === 'curl') {
                const p = extractExprStr(inputs['in_p']), q = extractExprStr(inputs['in_q']);
                if (!p || !q) return PayloadUtils.createError('Missing P/Q components');
                const dq_dx = svc.differentiate(q, var1).text(), dp_dy = svc.differentiate(p, var2).text();
                return PayloadUtils.createSymbolic(`(${dq_dx})-(${dp_dy})`);
            }
            return PayloadUtils.createError('Unsupported Mode');
        } catch (e: any) { return PayloadUtils.createError(`VectorField Failed: ${e.message}`); }
    },

    // DT-06: Vector Split
    'DT-06': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any, mode = data.mode || 'separate';
        if (mode === 'separate') {
            const inPayload = inputs['in'];
            if (!inPayload) return PayloadUtils.createError('No Input');
            const h = PayloadUtils.hydrate(PayloadUtils.unwrap(inPayload), math);
            const arr = (h && typeof h === 'object' && (h as any).toArray ? (h as any).toArray() : Array.isArray(h) ? h : [h]).flat(Infinity);
            return {
                type: DataType.Object,
                value: {
                    out_x: PayloadUtils.dehydrate(arr[0] ?? 0),
                    out_y: PayloadUtils.dehydrate(arr[1] ?? 0),
                    out_z: PayloadUtils.dehydrate(arr[2] ?? 0),
                    out_w: PayloadUtils.dehydrate(arr[3] ?? 0)
                },
                symbol: null,
                meta: {}
            };
        } else {
            const x = PayloadUtils.unwrap(inputs['in_x'] || PayloadUtils.createScalar(0));
            const y = PayloadUtils.unwrap(inputs['in_y'] || PayloadUtils.createScalar(0));
            const z = PayloadUtils.unwrap(inputs['in_z'] || PayloadUtils.createScalar(0));
            const w = PayloadUtils.unwrap(inputs['in_w'] || PayloadUtils.createScalar(0));
            return PayloadUtils.createMatrix([x, y, z, w]);
        }
    },

    // TR-03: Geometry
    'TR-03': (node, inputs) => {
        const data = (node.data || {}) as any, shape = data.shape || 'Circle';
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const getNum = (key: string) => Number(PayloadUtils.unwrap(inputs[key] || PayloadUtils.createScalar(0)));
        const a = getNum('in_a'), b = getNum('in_b');
        let area = 0, perimeter = 0;
        if (shape === 'Circle') { area = Math.PI * a * a; perimeter = 2 * Math.PI * a; }
        else if (shape === 'Rectangle') { area = a * b; perimeter = 2 * (a + b); }
        else if (shape === 'Triangle') { area = 0.5 * a * b; perimeter = a + b + Math.sqrt(a * a + b * b); }
        return {
            type: DataType.Object,
            value: { area: PayloadUtils.dehydrate(area), perimeter: PayloadUtils.dehydrate(perimeter) },
            symbol: null,
            meta: {}
        };
    },

    'CL-03': (node, inputs) => {
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
            }, (v: any) => PayloadUtils.wrap(v));
        } catch (e: any) { return PayloadUtils.createError(`Limit Failed: ${e.message}`); }
    },

    // CL-05: ODE Solver
    'CL-05': (node, inputs) => {
        const data = (node.data || {}) as any;
        const t0 = Number(data.t0) || 0;
        const tEnd = Number(data.tEnd) || 1;
        const y0 = Number(data.y0) || 1;
        const stepSize = Number(data.stepSize) || 0.01;
        const exprStr = extractExprStr(inputs['expr']);
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createError('No Expression Input');
        try {
            const svc = NerdamerService.getInstance();
            const compiled = svc.compileToFunction(exprStr, ['t', 'y']);
            const results: number[][] = [[t0, y0]];
            let t = t0, y = y0, steps = 0, maxSteps = 10000;
            while (t < tEnd && steps < maxSteps) {
                const h = Math.min(stepSize, tEnd - t);
                const k1 = Number(compiled({ t, y }));
                const k2 = Number(compiled({ t: t + h / 2, y: y + h * k1 / 2 }));
                const k3 = Number(compiled({ t: t + h / 2, y: y + h * k2 / 2 }));
                const k4 = Number(compiled({ t: t + h, y: y + h * k3 }));
                y = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
                t = t + h; steps++;
                if (!isFinite(y) || Math.abs(y) > 1e15) return PayloadUtils.createError(`ODE diverged at t=${t.toFixed(4)}`);
                results.push([parseFloat(t.toFixed(10)), y]);
            }
            return PayloadUtils.createMatrix(results as any);
        } catch (e: any) { return PayloadUtils.createError(`ODE Failed: ${e.message}`); }
    },

    // IN-09: Expert Node (Expression)
    'IN-09': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const code = String(data.code || '');
        if (!code) return PayloadUtils.createError('No Expression');
        try {
            const svc = NerdamerService.getInstance();
            const result = svc.evaluate(code);
            // result is already a string from svc.evaluate
            return PayloadUtils.createSymbolic(result);
        } catch (e: any) {
            return PayloadUtils.createError(`Eval Failed: ${e.message}`);
        }
    }
};
