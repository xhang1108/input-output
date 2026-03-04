import { DataType, NodePayload } from '../../../../types/payload';
import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { NodeEvaluator } from '../../../NodeRegistry';
import { InputOutputEngine } from '../../../InputOutputEngine';
import { NerdamerService } from '../../../calculus/NerdamerService';
import { RuntimeGuard } from '../../../calculus/RuntimeGuard';
import { MathCompileCache } from '../../../calculus/MathCompileCache';

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
            let scalarCode: any = null;
            if (mode === 'gradient') {
                const nodeExpr = typeof exprVal === 'string' ? math.parse(exprVal) : exprVal;
                // Double check if nodeExpr is actually differentiable (not a matrix)
                if (nodeExpr && (nodeExpr.isMatrixNode || nodeExpr.type === 'ArrayNode')) {
                    return PayloadUtils.createError('Gradient mode requires a scalar function (e.g. x^2+y^2). Use "direct" mode for vectors (e.g. [-y, x]).');
                }
                scalarCode = nodeExpr ? nodeExpr.compile() : null;
                uExpr = math.derivative(nodeExpr, var1);
                vExpr = math.derivative(nodeExpr, var2);
                outGrad = { type: DataType.Vector, value: [uExpr.toString(), vExpr.toString()], symbol: null, meta: {} };
            } else {
                // Phase 5.2: Support string vectors like "[-y, x]" from IOGL/FormulaNode
                let hydrated: any;
                if (typeof exprVal === 'string') {
                    const parsed = math.parse(exprVal);
                    // If it's an ArrayNode (mathjs internal), convert its items to strings
                    if (parsed && parsed.type === 'ArrayNode' && parsed.items) {
                        hydrated = parsed.items.map((item: any) => item.toString());
                    } else {
                        hydrated = PayloadUtils.hydrate(exprVal, math);
                    }
                } else {
                    hydrated = PayloadUtils.hydrate(exprVal, math);
                }

                const arr = (hydrated && typeof hydrated === 'object' && 'toArray' in hydrated ? (hydrated as any).toArray() : Array.isArray(hydrated) ? hydrated : []).flat(Infinity);
                if (arr.length < 2) return PayloadUtils.createError('Requires 2D vector [u, v] (e.g. [-y, x])');
                uExpr = typeof arr[0] === 'string' ? MathCompileCache.getCompiled(arr[0], math) : MathCompileCache.getCompiled(String(arr[0]), math);
                vExpr = typeof arr[1] === 'string' ? MathCompileCache.getCompiled(arr[1], math) : MathCompileCache.getCompiled(String(arr[1]), math);
            }

            const uCode = mode === 'gradient' ? uExpr.compile() : uExpr;
            const vCode = mode === 'gradient' ? vExpr.compile() : vExpr;
            const safeDensity = Math.max(1, Math.min(density, 100)); // Limit density
            const step = safeDensity > 1 ? (max - min) / (safeDensity - 1) : 0;
            const fieldData: number[][] = [];


            for (let i = 0; i < safeDensity; i++) {
                const yRaw = min + i * step;
                const y = Math.round(yRaw * 10000) / 10000;
                for (let j = 0; j < safeDensity; j++) {
                    const xRaw = min + j * step;
                    const x = Math.round(xRaw * 10000) / 10000;
                    const scope = { [var1]: x, [var2]: y };
                    try {
                        const u = Number(uCode.evaluate(scope));
                        const v = Number(vCode.evaluate(scope));

                        // Z value mapping: For gradient mode, the scalar field z. For direct vectors, their magnitude.
                        const zUnsafe = scalarCode ? scalarCode.evaluate(scope) : Math.hypot(u, v);
                        const z = Number(zUnsafe);

                        const validU = Number.isFinite(u) ? u : 0;
                        const validV = Number.isFinite(v) ? v : 0;
                        const validZ = Number.isFinite(z) ? z : 0;

                        // Pack [x, y, u, v, z] into a single Nx5 matrix
                        fieldData.push([x, y, validU, validV, validZ]);
                    }
                    catch {
                        fieldData.push([x, y, 0, 0, 0]);
                    }
                }
            }
            const result: any = {
                'out_field': { type: DataType.Matrix, value: fieldData, symbol: null, meta: { unit: inPayload.meta?.unit } }
            };
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
            const arr = (hydrated && typeof hydrated === 'object' && 'toArray' in hydrated ? (hydrated as any).toArray() : Array.isArray(hydrated) ? hydrated : [hydrated]).flat(Infinity);
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
                    if (h && typeof h === 'object' && 'toArray' in h) items.push(...(h as any).toArray().flat(Infinity));
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
            return typeof val === 'number' ? val : (val && typeof val === 'object' && 'toNumber' in val ? (val as any).toNumber() : Number(val) || 0);
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
        const engine = InputOutputEngine.getInstance();
        const math = engine.getMathInstance();
        try {
            const scope: Record<string, any> = {};
            for (const [key, val] of Object.entries(inputs)) {
                scope[key] = PayloadUtils.hydrate(PayloadUtils.unwrap(val), math);
            }

            // 1. Parse the entire block to inspect its structure
            let parsed;
            try {
                parsed = math.parse(code);
            } catch (e) {
                // If parsing fails but it looks like a one-line equation (x+y=z)
                // Treat it directly as a Symbolic Model
                if (code.includes('=') && !code.includes('\n')) {
                    return PayloadUtils.createSymbolic(code);
                }
                throw e;
            }

            // 2. Identify the "last action"
            let lastNode = parsed;
            if (parsed.type === 'BlockNode' && parsed.blocks) {
                // Get the last non-empty statement in the block
                const nonComments = parsed.blocks.filter((b: any) => b.node && b.node.type !== 'CommentNode');
                if (nonComments.length > 0) {
                    lastNode = nonComments[nonComments.length - 1].node;
                }
            }

            // 3. Apply the "Last-Line Rule"
            // If the last thing is an assignment (x=2, f(x)=x^2), it's a model
            const isAssignment = lastNode.type === 'AssignmentNode' || lastNode.type === 'FunctionAssignmentNode';

            // Evaluate the whole code to update the internal scope and get the final value
            const finalResult = MathCompileCache.evaluate(code, scope, math);

            if (isAssignment) {
                // If it's an assignment, we return the SYMBOLIC representation of the assignment
                // We use the evaluated result to show current state (e.g. y = 5 if x was 2)
                let symbolicVal = '';
                try {
                    // Re-parse just the last node to get its "evaluated string" if possible, 
                    // but for x=2 we want to see the result.
                    // Heuristic: If it's a simple x=2, returning the string is best for PlotNode.
                    const lastNodeStr = lastNode.toString();
                    if (lastNode.type === 'AssignmentNode') {
                        // For AssignmentNode, finalResult is the value.
                        // We construct a string "name = value"
                        symbolicVal = `${lastNode.name} = ${math.format(finalResult, { precision: 14 })}`;
                    } else {
                        symbolicVal = lastNodeStr;
                    }
                } catch {
                    symbolicVal = code.split('\n').pop() || code;
                }
                return PayloadUtils.createSymbolic(symbolicVal);
            }

            // 4. Fallback to Scalar/Matrix
            const isHeavy = Array.isArray(finalResult) || (finalResult as any)?.isMatrix;
            return {
                type: isHeavy ? DataType.Matrix : DataType.Scalar,
                value: PayloadUtils.dehydrate(finalResult),
                symbol: null,
                meta: {}
            };
        } catch (error) {
            return PayloadUtils.createError(String(error));
        }
    }
};
