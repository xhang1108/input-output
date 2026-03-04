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

export const MathEvaluators: Record<string, NodeEvaluator> = {
    'MA-01': (node, inputs) => {
        const engine = InputOutputEngine.getInstance();
        const mathInstance = engine.getMathInstance();

        const payloadA = inputs['in_a'];
        const payloadB = inputs['in_b'];

        // Strict Check: Math nodes (MA-01) do NOT support equations/symbolic models.
        if (payloadA?.type === DataType.Symbolic || payloadB?.type === DataType.Symbolic) {
            return PayloadUtils.createError("Type Mismatch: Math nodes cannot process Equations (Symbolic). Use a Solver Node.");
        }

        const getHydrated = (p: NodePayload | undefined) => {
            if (!p) return 0;
            const hydrated = PayloadUtils.unwrap(p);
            const mathHydrated = PayloadUtils.hydrate(hydrated, mathInstance);
            const h = mathHydrated as { isBigNumber?: boolean };
            if (p.meta?.unit && (typeof mathHydrated === 'number' || (h && h.isBigNumber))) {
                const m = mathInstance as unknown as Record<string, (v: unknown, u: string) => unknown>;
                try { return m.unit(mathHydrated, p.meta.unit); } catch (e: unknown) { return mathHydrated; }
            }
            return mathHydrated;
        };

        const valA = getHydrated(payloadA);
        const valB = getHydrated(payloadB);
        const data = (node.data || {}) as Record<string, unknown>;
        const op = data.op as string || 'ADD';

        const extractValue = (v: unknown) => {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                const obj = v as Record<string, unknown>;
                if (!obj.isMatrix && !obj.isUnit && !obj.isBigNumber) {
                    if ('vec3' in obj) return obj.vec3;
                    if ('value' in obj) return obj.value;
                }
            }
            return v;
        };

        let procA = extractValue(valA);
        let procB = extractValue(valB);

        const toBig = (v: unknown) => {
            if (typeof v === 'number') return (mathInstance as any).bignumber(v);
            return v;
        };
        procA = toBig(procA);
        procB = toBig(procB);

        if (op === 'ADD' || op === 'SUB') {
            const hA = procA as any;
            const hB = procB as any;
            const isUnitA = hA && (hA.isUnit || hA.constructor?.name === 'Unit');
            const isUnitB = hB && (hB.isUnit || hB.constructor?.name === 'Unit');
            const isMatrixA = hA && (Array.isArray(hA) || hA.isMatrix || hA.constructor?.name === 'Matrix');
            const isMatrixB = hB && (Array.isArray(hB) || hB.isMatrix || hB.constructor?.name === 'Matrix');

            if ((isMatrixA && !isMatrixB) || (!isMatrixA && isMatrixB)) {
                return PayloadUtils.createError("Strict Mode: Cannot add/sub Matrix and Scalar");
            }

            if (isUnitA && !isUnitB && (mathInstance as any).equal(procB, 0)) procB = (mathInstance as any).unit(0, hA.formatUnits());
            else if (!isUnitA && isUnitB && (mathInstance as any).equal(procA, 0)) procA = (mathInstance as any).unit(0, hB.formatUnits());
        }

        try {
            const m = (mathInstance as any);
            let result: unknown;
            switch (op) {
                case 'ADD': result = m.add(procA, procB); break;
                case 'SUB': result = m.subtract(procA, procB); break;
                case 'MUL': result = m.multiply(procA, procB); break;
                case 'DIV': result = m.divide(procA, procB); break;
                case 'POW': result = m.pow(procA, procB); break;
                case 'SQRT': result = m.sqrt(procA); break;
                case 'ABS': result = m.abs(procA); break;
                case 'SIN': result = m.sin(procA); break;
                case 'COS': result = m.cos(procA); break;
                case 'TAN': result = m.tan(procA); break;
                default: result = m.add(procA, procB);
            }

            let finalValue = result;
            let finalUnit: string | undefined;
            const metaA = inputs['in_a']?.meta || {};
            const metaB = inputs['in_b']?.meta || {};
            const combinedMeta: Record<string, unknown> = {};

            if (metaA.unit && metaB.unit && metaA.unit === metaB.unit) combinedMeta.unit = metaA.unit;
            else if (metaA.unit && !metaB.unit) combinedMeta.unit = metaA.unit;
            else if (!metaA.unit && metaB.unit) combinedMeta.unit = metaB.unit;

            if (result && typeof result === 'object') {
                const obj = result as any;
                if (obj.isUnit || obj.constructor?.name === 'Unit') {
                    finalUnit = obj.formatUnits();
                    try { finalValue = obj.toNumber(finalUnit); } catch (e) { finalValue = obj.value; }
                    return {
                        ...PayloadUtils.createScalar(PayloadUtils.dehydrate(finalValue), finalUnit),
                        meta: { ...combinedMeta, unit: finalUnit }
                    };
                }
            }
            return { ...PayloadUtils.wrap(result), meta: combinedMeta };
        } catch (e: any) {
            return PayloadUtils.createError(e.message);
        }
    },
    'MA-03': (node) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const label = data.val || 'pi';
        let value = math[label] ?? (label === 'Infinity' ? Infinity : 0);
        const precision = data.precision;
        if (precision !== undefined && precision !== -1) {
            value = math.round(value, precision);
        }
        return {
            type: DataType.Scalar,
            value: PayloadUtils.dehydrate(value),
            symbol: null,
            meta: {}
        };
    },
    'MA-14': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const valPayload = inputs['in_a'] || PayloadUtils.createScalar(0);
        const data = (node.data || {}) as any;
        const prec = data.precision ?? 0;
        const val = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        try {
            const result = math.round(val, prec);
            return {
                type: DataType.Scalar,
                value: PayloadUtils.dehydrate(result),
                symbol: null,
                meta: { unit: valPayload.meta?.unit }
            };
        } catch (e) { return PayloadUtils.createError('Op Failed'); }
    },
    'MA-12': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const raw = PayloadUtils.unwrap(inputs['in']);
        const data = (node.data || {}) as any;
        const isMixed = data.mixed === true;
        try {
            if (raw === null || raw === undefined) return PayloadUtils.createScalar(0);
            const f = math.fraction(raw);
            let n = Number(f.n), d = Number(f.d), integerPart = 0;
            let str = math.format(f);
            if (isMixed && d !== 0) {
                integerPart = Math.floor(n / d);
                n = n % d;
                if (integerPart !== 0) str = n === 0 ? `${integerPart}` : `${integerPart} ${n}/${d}`;
            }
            return {
                type: DataType.Object,
                value: {
                    int: PayloadUtils.createScalar(integerPart),
                    numerator: PayloadUtils.createScalar(n),
                    denominator: PayloadUtils.createScalar(d),
                    string: PayloadUtils.createString(str)
                },
                symbol: null,
                meta: {}
            };
        } catch (e) { return PayloadUtils.createError('Invalid Fraction'); }
    },
    'MA-02': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'GCD';
        const getVal = (key: string) => {
            const p = inputs[key];
            if (!p) return 0;
            const val = PayloadUtils.unwrap(p);
            const hydrated = PayloadUtils.hydrate(val, math) as any;
            if (p.meta?.unit && (typeof hydrated === 'number' || hydrated?.isBigNumber)) {
                try { return hydrated.toNumber ? hydrated.toNumber() : Number(hydrated); } catch (e) { return 0; }
            }
            return hydrated;
        };
        const valA = getVal('in_a');
        const valB = getVal('in_b');
        try {
            let result;
            switch (op) {
                case 'GCD': result = math.gcd(valA, valB); break;
                case 'LCM': result = math.lcm(valA, valB); break;
                case 'MOD': result = math.mod(valA, valB); break;
                case 'IS_PRIME': result = math.isPrime(valA); break;
                default: result = 0;
            }
            if (op === 'IS_PRIME') return PayloadUtils.createBoolean(!!result);
            const finalValue = (result as any)?.isBigNumber ? (result as any).toNumber() : result;
            return { type: DataType.Scalar, value: PayloadUtils.dehydrate(finalValue), symbol: null, meta: {} };
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    },
    'MA-15': (node, inputs) => {
        const data = (node.data || {}) as any;
        const inputPayload = inputs['in'];
        const targetBase = data.base || 'HEX';
        let finalValue = 0;
        if (inputPayload) {
            const raw = PayloadUtils.unwrap(inputPayload);
            if (typeof raw === 'number') finalValue = raw;
            else {
                const hydrated = PayloadUtils.hydrate(raw, InputOutputEngine.getInstance().getMathInstance());
                if (typeof hydrated === 'number') finalValue = hydrated;
                else if (hydrated && typeof hydrated === 'object' && 'toNumber' in hydrated) {
                    finalValue = (hydrated as any).toNumber((hydrated as any).isUnit ? undefined : '');
                }
            }
        }
        return { type: DataType.Scalar, value: finalValue, symbol: inputPayload?.symbol || null, meta: { unit: targetBase } };
    },
    'MA-16': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const valPayload = inputs['in'] || PayloadUtils.createScalar(0);
        const data = (node.data || {}) as any;
        const op = data.op || 'LN';
        const val = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        try {
            let result;
            if (op === 'LOG10') result = math.log10(val);
            else if (op === 'LOG_N') result = math.log(val, inputs['base'] ? PayloadUtils.hydrate(PayloadUtils.unwrap(inputs['base']), math) : 10);
            else result = math.log(val);
            return { type: DataType.Scalar, value: PayloadUtils.dehydrate(result), symbol: null, meta: {} };
        } catch (e) { return PayloadUtils.createError('Log Failed'); }
    },

    // DA-06: Array Extract
    'DA-06': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const valPayload = inputs['in'];
        const idxPayload = inputs['index'];
        if (!valPayload || !idxPayload) return PayloadUtils.createError('Missing Inputs');
        let arr = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        let idx = PayloadUtils.hydrate(PayloadUtils.unwrap(idxPayload), math);
        try {
            let i = typeof idx === 'number' ? idx : (idx && typeof idx === 'object' && 'toNumber' in idx) ? (idx as any).toNumber() : 0;
            let result: unknown;
            if (arr && typeof arr === 'object' && 'get' in (arr as any)) {
                try {
                    const size = (arr as any).size();
                    if (size.length === 1) result = (arr as any).get([Math.floor(i)]);
                    else {
                        const indexObj = math.index(Math.floor(i));
                        result = math.subset(arr, indexObj);
                    }
                } catch (e) {
                    const flat = (arr as any).toArray ? (arr as any).toArray() : arr;
                    result = Array.isArray(flat) ? flat[Math.floor(i)] : flat;
                }
            } else if (Array.isArray(arr)) result = arr[Math.floor(i)];
            else result = arr;
            return {
                type: Array.isArray(result) || (result && (result as any).isMatrix) ? DataType.Matrix : DataType.Scalar,
                value: PayloadUtils.dehydrate(result),
                symbol: null,
                meta: { unit: valPayload.meta?.unit }
            };
        } catch (e: unknown) { return PayloadUtils.createError('Extract Failed (Out of Bounds?)'); }
    },

    // DA-07: Array Builder
    'DA-07': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as Record<string, unknown>;
        const axis = data.axis as number || 0;
        let items: any[] = [];
        if (inputs['in']) {
            const val = inputs['in'];
            if (Array.isArray(val)) items = val.map(p => PayloadUtils.hydrate(PayloadUtils.unwrap(p), math));
            else items = [PayloadUtils.hydrate(PayloadUtils.unwrap(val), math)];
        } else {
            const inputKeys = Object.keys(inputs).filter(k => k.startsWith('in_')).sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));
            items = inputKeys.map(k => PayloadUtils.hydrate(PayloadUtils.unwrap(inputs[k]), math));
        }
        if (items.length === 0) return PayloadUtils.createMatrix([]);
        try {
            if (items.length === 1) return {
                type: Array.isArray(items[0]) || (items[0] && (items[0] as any).isMatrix) ? DataType.Matrix : DataType.Scalar,
                value: PayloadUtils.dehydrate(items[0]), symbol: null, meta: {}
            };
            let result: unknown;
            try { result = math.concat(...items, axis); } catch (e) { result = math.matrix(items); }
            return { type: DataType.Matrix, value: PayloadUtils.dehydrate(result), symbol: null, meta: {} };
        } catch (e: unknown) { return PayloadUtils.createMatrix(PayloadUtils.dehydrate(items)); }
    },

    // DA-01: Statistics
    'DA-01': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'Mean';
        const valPayload = inputs['data'];
        if (!valPayload) return PayloadUtils.createError('No Input');
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        let arr: any[] = [];
        if (hydrated && typeof hydrated === 'object' && 'toArray' in (hydrated as any)) arr = (hydrated as any).toArray().flat(Infinity);
        else if (Array.isArray(hydrated)) arr = hydrated.flat(Infinity);
        else arr = [hydrated];
        if (arr.length === 0) return PayloadUtils.createError('Empty Array');
        try {
            let result: unknown = 0;
            switch (op) {
                case 'Mean': result = math.mean(arr); break;
                case 'Max': result = math.max(arr); break;
                case 'Min': result = math.min(arr); break;
                case 'StdDev': result = math.std(arr); break;
                case 'Median': result = math.median(arr); break;
                case 'Variance': result = math.variance(arr); break;
                case 'Sum': result = math.sum(arr); break;
                default: result = math.mean(arr);
            }
            return PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
        } catch (e: any) { return PayloadUtils.createError(`Stats Failed: ${e.message}`); }
    },

    // DA-02: Smoothing
    'DA-02': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        let windowSize = inputs['window'] ? Number(PayloadUtils.unwrap(inputs['window'])) || 3 : (data.windowMode ?? 3);
        const valPayload = inputs['data'];
        if (!valPayload) return PayloadUtils.createError('No Input');
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        let arr: any[] = (hydrated && typeof hydrated === 'object' && 'toArray' in (hydrated as any)) ? (hydrated as any).toArray().flat(Infinity) : (Array.isArray(hydrated) ? hydrated.flat(Infinity) : [hydrated]);
        if (arr.length === 0) return PayloadUtils.createMatrix([]);
        windowSize = Math.max(1, Math.min(arr.length, Math.floor(windowSize)));
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            let sum = 0, count = 0;
            const start = Math.max(0, i - Math.floor(windowSize / 2)), end = Math.min(arr.length - 1, i + Math.floor(windowSize / 2));
            for (let j = start; j <= end; j++) { sum += Number(arr[j]) || 0; count++; }
            result.push(sum / count || 0);
        }
        return PayloadUtils.createMatrix(PayloadUtils.dehydrate(result));
    },

    // DA-03: List Utility
    'DA-03': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any, mode = data.mode || 'Sort (Asc)';
        const valPayload = inputs['data'];
        if (!valPayload) return PayloadUtils.createError('No Input');
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        let arr: any[] = (hydrated && typeof hydrated === 'object' && 'toArray' in (hydrated as any)) ? (hydrated as any).toArray().flat(Infinity) : (Array.isArray(hydrated) ? hydrated.flat(Infinity) : [hydrated]);
        if (arr.length === 0) return PayloadUtils.createMatrix([]);
        let result = [...arr];
        if (mode === 'Sort (Asc)') result.sort((a, b) => Number(a) - Number(b));
        else if (mode === 'Sort (Desc)') result.sort((a, b) => Number(b) - Number(a));
        else if (mode === 'Reverse') result.reverse();
        else if (mode === 'Unique') result = [...new Set(result.map(x => String(x)))].map((x: any) => (isNaN(Number(x)) ? x : Number(x)));
        else if (mode === 'Clean') result = result.filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));
        return PayloadUtils.createMatrix(PayloadUtils.dehydrate(result));
    },

    // DA-04: Set Operations
    'DA-04': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const mode = ((node.data || {}) as any).mode || 'Union';
        const getArr = (key: string) => {
            const p = inputs[key]; if (!p) return [];
            const h = PayloadUtils.hydrate(PayloadUtils.unwrap(p), math) as any;
            return (h && typeof h === 'object' && 'toArray' in h) ? h.toArray().flat(Infinity) : (Array.isArray(h) ? h.flat(Infinity) : [h]);
        };
        const setA = new Set<string>(getArr('a').map((x: any) => String(x)));
        const setB = new Set<string>(getArr('b').map((x: any) => String(x)));
        let resultSet: string[] = [];
        if (mode === 'Union') resultSet = Array.from(new Set<string>([...Array.from(setA), ...Array.from(setB)]));
        else if (mode === 'Intersection') resultSet = Array.from(setA).filter((x: string) => setB.has(x));
        else if (mode === 'Difference') resultSet = Array.from(setA).filter((x: string) => !setB.has(x));
        const final = resultSet.map((x: string) => (isNaN(Number(x)) ? x : Number(x)));
        return PayloadUtils.createMatrix(PayloadUtils.dehydrate(final));
    },

    // DA-05: Distributions
    'DA-05': (node, inputs) => {
        const data = (node.data || {}) as any, mode = data.mode || 'Normal';
        const n = Math.max(1, Math.min(100000, Math.floor(Number(PayloadUtils.unwrap(inputs['param_n']) ?? data.n ?? 100))));
        const p1 = Number(PayloadUtils.unwrap(inputs['param_1']) ?? data.p1 ?? (mode === 'Normal' ? 0 : 1));
        const p2 = Number(PayloadUtils.unwrap(inputs['param_2']) ?? data.p2 ?? (mode === 'Uniform' ? 10 : 1));
        const samples = new Array(n);
        try {
            if (mode === 'Normal') {
                for (let i = 0; i < n; i++) {
                    let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random();
                    samples[i] = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * p2 + p1;
                }
            } else if (mode === 'Uniform') {
                const min = Math.min(p1, p2), max = Math.max(p1, p2);
                for (let i = 0; i < n; i++) samples[i] = min + Math.random() * (max - min);
            } else if (mode === 'Poisson') {
                const L = Math.exp(-p1);
                for (let i = 0; i < n; i++) {
                    let p = 1.0, k = 0; do { k++; p *= Math.random(); } while (p > L);
                    samples[i] = k - 1;
                }
            }
            return PayloadUtils.createMatrix(PayloadUtils.dehydrate(samples));
        } catch { return PayloadUtils.createError('Distribution Failed'); }
    },

    // SY-04: ODE Solver
    'SY-04': (node, inputs) => {
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
            let t = t0; let y = y0;
            const maxSteps = 10000; let steps = 0;
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
    }
};
