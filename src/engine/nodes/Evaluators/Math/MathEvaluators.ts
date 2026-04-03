import { InputOutputEngine } from '../../../InputOutputEngine';
import { DataType, NodePayload } from '../../../../types/payload';
import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { NodeEvaluator } from '../../../NodeRegistry';
import { UnitAlgebra } from '../../../../utils/UnitAlgebra';



/**
 * Seeded Random Number Generator (Mulberry32)
 * Provides deterministic results for a given seed.
 */
function seededRandom(seed: number) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export const MathEvaluators: Record<string, NodeEvaluator> = {
    'MA-01': (node, inputs) => {
        const engine = InputOutputEngine.getInstance();
        const mathInstance = engine.getMathInstance();

        const payloadA = inputs['in_a'];
        const payloadB = inputs['in_b'];

        // Strict Check: Math nodes (MA-01/MA-02) do NOT support equations/symbolic models.
        if (payloadA?.type === DataType.Symbolic || payloadB?.type === DataType.Symbolic) {
            return PayloadUtils.createError("Type Mismatch: Math nodes cannot process Equations (Symbolic). Use a Solver Node.");
        }

        const getHydrated = (p: NodePayload | undefined) => {
            if (!p) return 0;
            const hydrated = PayloadUtils.unwrap(p);
            const mathHydrated = PayloadUtils.hydrate(hydrated, mathInstance);
            // Strip Unit objects: if hydrate reconstructed a mathjs Unit from cached
            // {mathjs:'Unit'} values, extract the plain number. Unit algebra is handled
            // exclusively via metadata + UnitAlgebra.
            if (mathHydrated && typeof mathHydrated === 'object') {
                const obj = mathHydrated as any;
                if (obj.isUnit || obj.constructor?.name === 'Unit') {
                    try { return obj.toNumber(obj.formatUnits()); } catch { return obj.value ?? 0; }
                }
            }
            return mathHydrated;
        };

        const valA = getHydrated(payloadA);
        const valB = getHydrated(payloadB);
        const data = (node.data || {}) as Record<string, unknown>;
        const op = (data.mode as string || data.op as string || 'ADD').toUpperCase();

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
            const isArrayA = hA && (Array.isArray(hA) || hA.isMatrix || hA.constructor?.name === 'Matrix');
            const isArrayB = hB && (Array.isArray(hB) || hB.isMatrix || hB.constructor?.name === 'Matrix');

            if ((isArrayA && !isArrayB) || (!isArrayA && isArrayB)) {
                return PayloadUtils.createError("Strict Mode: Cannot add/sub Array and Scalar");
            }

            // Unit-aware ADD/SUB
            const unitA = (inputs['in_a']?.meta?.unit as string) || undefined;
            const unitB = (inputs['in_b']?.meta?.unit as string) || undefined;

            if (unitA && unitB && unitA !== unitB) {
                // Different unit strings: try mathjs dimension-compatible conversion
                const mi = mathInstance as any;
                try {
                    // Convert BigNumbers to plain numbers for mathjs unit()
                    const numA = (procA as any).isBigNumber ? (procA as any).toNumber() : Number(procA);
                    const numB = (procB as any).isBigNumber ? (procB as any).toNumber() : Number(procB);
                    const uA = mi.unit(numA, unitA);
                    const uB = mi.unit(numB, unitB);
                    const converted = (op === 'ADD') ? mi.add(uA, uB) : mi.subtract(uA, uB);
                    // Extraction: Target unitA dimension.
                    // IMPORTANT: mathjs.unit.value is always in SI base units.
                    // We must use .toNumber(unitA) or equivalent to get 1.5 for "1.5 km".
                    const numResult = converted.toNumber(unitA); 
                    return PayloadUtils.createScalar(numResult, unitA);
                } catch {
                    // mathjs doesn't know one/both units, or they're incompatible dimensions
                    return PayloadUtils.createError(`Cannot ${op === 'ADD' ? 'add' : 'subtract'}: ${unitA} and ${unitB} are incompatible`);
                }
            }
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
                case 'SQRT':
                    result = (payloadB && !m.equal(procB, 0)) ? m.nthRoot(procA, procB) : m.sqrt(procA);
                    break;
                case 'ABS': result = m.abs(procA); break;
                case 'NEG': result = m.unaryMinus(procA); break;
                case 'SIGN': result = m.sign(procA); break;
                case 'CBRT': result = m.cbrt(procA); break;
                case 'FACT': result = m.factorial(procA); break;
                default: result = m.add(procA, procB);
            }

            // Guard: If the math result is a Unit object (e.g. from mathjs internal coercion),
            // extract its numeric value so PayloadUtils.wrap produces a clean Scalar.
            if (result && typeof result === 'object') {
                const obj = result as any;
                if (obj.isUnit || obj.constructor?.name === 'Unit') {
                    result = obj.value; // Keep as BigNumber
                }
            }

            const metaA = inputs['in_a']?.meta || {};
            const metaB = inputs['in_b']?.meta || {};
            const combinedMeta: Record<string, unknown> = {};

            // Algebraic unit merge via UnitAlgebra
            combinedMeta.unit = UnitAlgebra.merge(
                metaA.unit as string | undefined,
                metaB.unit as string | undefined,
                op
            );

            return PayloadUtils.createScalar(result, combinedMeta.unit as string);
        } catch (e: any) {
            return PayloadUtils.createError(e.message);
        }
    },
    'MA-02': (node, inputs) => MathEvaluators['MA-01'](node, inputs),
    'MA-18': (node, inputs) => MathEvaluators['MA-01'](node, inputs),
    'MA-08': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'nCr';

        const valN = inputs['in_a'];
        const valR = inputs['in_b'];

        if (!valN) return PayloadUtils.createError('Missing Input (n)');

        // Factorial only needs 'n'
        if (op !== 'FACTORIAL' && !valR) return PayloadUtils.createError('Missing Input (r)');

        try {
            const n = PayloadUtils.hydrate(PayloadUtils.unwrap(valN), math);
            const r = valR ? PayloadUtils.hydrate(PayloadUtils.unwrap(valR), math) : 0;

            let result: any;
            if (op === 'nCr') result = math.combinations(n, r);
            else if (op === 'nPr') result = math.permutations(n, r);
            else if (op === 'FACTORIAL') result = math.factorial(n);
            else result = math.combinations(n, r);

            return PayloadUtils.createScalar(result);
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    },
    'MA-05': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const valPayload = inputs['in_a'] || PayloadUtils.createScalar(0);
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'ROUND';
        const prec = data.precision ?? 0;
        const val = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        try {
            let result;
            if (op === 'FLOOR') result = math.floor(val);
            else if (op === 'CEIL') result = math.ceil(val);
            else if (op === 'TRUNC') result = math.fix(val);
            else result = math.round(val, prec);

            return PayloadUtils.createScalar(result, valPayload.meta?.unit as string);
        } catch (e) { return PayloadUtils.createError('Op Failed'); }
    },
    'MA-14': (node, inputs) => (MathEvaluators as any)['MA-05'](node, inputs),
    'MA-06': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const raw = PayloadUtils.hydrate(PayloadUtils.unwrap(inputs['in_a']), math);
        const data = (node.data || {}) as any;
        const isMixed = data.mixed === true;
        try {
            if (raw === null || raw === undefined) return PayloadUtils.createScalar(0);
            // Important: mathjs.fraction(BigNumber) creates huge numerators/denominators for decimals.
            // Using Number(raw) allows fraction.js to use rational approximation for results like 1/3 (0.333...).
            // We use a small epsilon or rely on mathjs's internal precision handling.
            const valNum = typeof raw === 'object' && (raw as any).isBigNumber ? (raw as any).toNumber() : Number(raw);
            const f = math.fraction(valNum);
            let n = Number(f.n), d = Number(f.d), integerPart = 0;
            let str = math.format(f);
            let latex = str;
            if (isMixed && d !== 0) {
                integerPart = Math.floor(n / d);
                n = n % d;
                if (integerPart !== 0) {
                    str = n === 0 ? `${integerPart}` : `${integerPart} ${n}/${d}`;
                    latex = n === 0 ? `${integerPart}` : `${integerPart} \\frac{${n}}{${d}}`;
                } else {
                    latex = `\\frac{${n}}{${d}}`;
                }
            } else if (d !== 1 && d !== 0) {
                latex = `\\frac{${n}}{${d}}`;
            }

            return {
                type: DataType.Object,
                value: {
                    out_a: PayloadUtils.createScalar(integerPart),
                    out_b: PayloadUtils.createScalar(n),
                    out_c: PayloadUtils.createScalar(d),
                    out_d: PayloadUtils.createString(str),
                    latex: PayloadUtils.createString(latex)
                },
                symbol: null,
                meta: {}
            };
        } catch (e) { return PayloadUtils.createError('Invalid Fraction'); }
    },
    'MA-12': (node, inputs) => (MathEvaluators as any)['MA-06'](node, inputs),
    'MA-07': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'GCD';

        const collectNumbers = (p: NodePayload | NodePayload[] | undefined): any[] => {
            if (!p) return [];

            // Handle Capsule Input (Array of Payloads)
            if (Array.isArray(p)) {
                return p.flatMap(item => collectNumbers(item));
            }

            const unwrapped = PayloadUtils.unwrap(p);
            const hydrated = PayloadUtils.hydrate(unwrapped, math);

            if (hydrated === null || hydrated === undefined) return [];

            // Flatten if it's a matrix or array
            if (typeof hydrated === 'object' && (hydrated as any).isMatrix) {
                return (hydrated as any).toArray().flat(Infinity);
            }
            if (Array.isArray(hydrated)) {
                return hydrated.flat(Infinity);
            }
            return [hydrated];
        };

        try {
            let result: any;
            if (op === 'GCD' || op === 'LCM') {
                const allNumbers = [
                    ...collectNumbers(inputs['in_a']),
                    ...collectNumbers(inputs['in_b'])
                ];
                if (allNumbers.length === 0) return PayloadUtils.createScalar(0);
                if (allNumbers.length === 1) {
                    result = allNumbers[0];
                } else {
                    result = op === 'GCD' ? math.gcd(...allNumbers) : math.lcm(...allNumbers);
                }
            } else if (op === 'MOD') {
                const valsA = collectNumbers(inputs['in_a']);
                const valsB = collectNumbers(inputs['in_b']);
                const valA = valsA.length > 0 ? valsA[0] : 0;
                const valB = valsB.length > 0 ? valsB[0] : 1;

                if (Number(valB) === 0) {
                    return PayloadUtils.createError('Modulo by zero');
                }

                result = math.mod(valA, valB);
            } else if (op === 'ISPRIME') {
                const valsA = collectNumbers(inputs['in_a']);
                const primes = valsA.filter(n => math.isPrime(n));
                return PayloadUtils.createArray(primes);
            } else {
                result = 0;
            }

            const finalValue = (result as any)?.isBigNumber ? (result as any).toNumber() : result;
            return PayloadUtils.createScalar(finalValue);
        } catch (e: any) {
            return PayloadUtils.createError(`${op} Failed: ${e.message}`);
        }
    },
    'MA-15': (node, inputs) => {
        const data = (node.data || {}) as any;
        const inputPayload = inputs['in_a'];
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
        return PayloadUtils.createScalar(finalValue, targetBase);
    },
    'MA-03_OLD': (node, inputs) => MathEvaluators['MA-03'](node, inputs), // Alias if needed
    'MA-04': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const valPayload = inputs['in_a'] || PayloadUtils.createScalar(0);
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'SIN';
        const angleMode = data.angleMode || 'RAD';
        let val = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);

        if (angleMode === 'DEG' && ['SIN', 'COS', 'TAN'].includes(op)) {
            try { val = math.multiply(val, math.divide(math.pi, 180)); } catch (e) { }
        }

        try {
            let result;
            switch (op) {
                case 'SIN': result = math.sin(val); break;
                case 'COS': result = math.cos(val); break;
                case 'TAN': result = math.tan(val); break;
                case 'ASIN': result = math.asin(val); break;
                case 'ACOS': result = math.acos(val); break;
                case 'ATAN': result = math.atan(val); break;
                default: result = math.sin(val);
            }

            if (angleMode === 'DEG' && ['ASIN', 'ACOS', 'ATAN'].includes(op)) {
                try { result = math.multiply(result, math.divide(180, math.pi)); } catch (e) { }
            }

            return PayloadUtils.createScalar(result);
        } catch (e) { return PayloadUtils.createError('Trig Failed'); }
    },
    'MA-03': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const valPayload = inputs['in_a'] || PayloadUtils.createScalar(0);
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'LN';
        const val = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        try {
            let result;
            if (op === 'LOG10') result = math.log10(val);
            else if (op === 'LOGN') result = math.log(val, (inputs['in_b']) ? PayloadUtils.hydrate(PayloadUtils.unwrap(inputs['in_b']), math) : 10);
            else result = math.log(val);
            return PayloadUtils.createScalar(result);
        } catch (e) { return PayloadUtils.createError('Log Failed'); }
    },
    'MA-17': (node, inputs) => MathEvaluators['MA-04'](node, inputs),







    // IN-10: Unified Random Node (Professional Stochastic Generator)
    'IN-10': (node, inputs) => {
        const data = (node.data || {}) as Record<string, unknown>;

        // Decoupled Property Support (v3.0) with Backward Compatibility
        let distribution = (data.mode as string || 'Uniform');
        let isFloat = data.isFloat !== false; // Default to true for historical reasons

        const distKey = distribution.toLowerCase();

        // Sampling parameters helper
        const getNum = (key: string, def: number) => {
            const val = inputs[key] ? PayloadUtils.unwrap(inputs[key]) : data[key];
            return val !== undefined ? Number(val) : def;
        };

        const rows = Math.max(1, Math.floor(getNum('rows', 1)));
        const cols = Math.max(1, Math.floor(getNum('cols', 1)));

        // Pure Random (Non-seeded per roadmap)
        const rng = () => Math.random();

        // Core Generator Logic
        const sample = (): number => {
            if (distKey === 'normal') {
                const mean = getNum('mean', 0);
                const stdDev = getNum('stdDev', 1);
                let u = 0, v = 0;
                while (u === 0) u = rng();
                while (v === 0) v = rng();
                const res = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdDev + mean;
                return isFloat ? res : Math.floor(res);
            } else if (distKey === 'poisson') {
                const lambda = getNum('lambda', 1);
                const L = Math.exp(-lambda);
                let p = 1.0, k = 0;
                do { k++; p *= rng(); } while (p > L);
                return k - 1; // Poisson is always integer
            } else if (distKey === 'exponential' || distKey === 'exp') {
                const lambda = getNum('lambda', 1);
                const res = -Math.log(rng()) / lambda;
                return isFloat ? res : Math.floor(res);
            } else {
                // Default: Uniform
                const min = getNum('min', 0);
                const max = getNum('max', 1);
                const res = rng() * (max - min) + min;
                return isFloat ? res : Math.floor(res);
            }
        };

        // Cache Management: Ensure we re-sample only when configuration changes
        const currentDataHash = JSON.stringify({
            seed: data.seed,
            distribution, isFloat,
            rows, cols,
            params: {
                min: getNum('min', 0), max: getNum('max', 1),
                mean: getNum('mean', 0), stdDev: getNum('stdDev', 1),
                lambda: getNum('lambda', 1)
            }
        });

        const lastDataHash = (node as any)._lastDataHash;
        if (lastDataHash === currentDataHash && node.value) {
            return node.value;
        }
        (node as any)._lastDataHash = currentDataHash;

        try {
            if (rows > 1 && cols > 1) {
                const mat = Array.from({ length: rows }, () => Array.from({ length: cols }, sample));
                return PayloadUtils.createArray(mat);
            } else if (rows > 1 || cols > 1) {
                const len = rows > 1 ? rows : cols;
                const vec = Array.from({ length: len }, sample);
                return PayloadUtils.createArray(vec);
            } else {
                // Per user request: Even 1x1 is returned as an array [val] to match purple handle
                return PayloadUtils.createArray([sample()]);
            }
        } catch (e: any) {
            return PayloadUtils.createError(`Random Failed: ${e.message}`);
        }
    },

    // IN-06: Constant
    'IN-06': (node) => {
        const data = (node.data || {}) as any;
        const valId = data.val || 'pi';
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const precision = Number(data.precision ?? 5);

        let result: any;
        if (valId === 'pi') result = math.pi;
        else if (valId === 'e') result = math.e;
        else if (valId === 'phi') result = math.phi;
        else if (valId === 'tau') result = math.tau;
        else result = math.pi;

        if (math.bignumber) {
            result = math.bignumber(result);
            // Precision >= 0 means Round to Decimal Places (not sig-figs)
            if (precision >= 0) {
                result = math.round(result, precision);
                // After rounding, evaluate ensures it's a clean BigNumber or number
                result = math.evaluate(math.format(result));
            }
        }

        return PayloadUtils.createScalar(result);
    },

    // TR-01: Unit
    'TR-01': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const isCustom = data.unit === 'CUSTOM';
        const targetUnit = isCustom ? data.customUnit : (data.unit || 'm');
        const valPayload = inputs['in_a'];
        if (!valPayload) return PayloadUtils.createScalar(0, targetUnit);

        // Feature: Remove Unit
        if (data.unit === 'REMOVE') {
            const raw = PayloadUtils.unwrap(valPayload);
            return PayloadUtils.createScalar(raw);
        }

        try {
            const raw = PayloadUtils.unwrap(valPayload);
            const sourceUnit = valPayload.meta?.unit;

            // Unit conversion logic:
            // If the input already has a unit different from target, we MUST try to convert or error.
            if (sourceUnit && sourceUnit !== targetUnit) {
                try {
                    // Correctly hydrate the value (e.g. from dehydrated BigNumber) before numeric conversion
                    const hydrated = PayloadUtils.hydrate(valPayload.value, math);
                    const result = math.unit(hydrated, sourceUnit).to(targetUnit);
                    // result.value is in SI base units. To get it in target units with high precision:
                    const targetFactor = math.unit(1, targetUnit).value;
                    const convertedValue = math.divide(result.value, targetFactor);
                    
                    return PayloadUtils.createScalar(convertedValue, targetUnit);
                } catch (e: any) {
                    // Division by zero or incompatible dimensions
                    return PayloadUtils.createError(`Cannot convert ${sourceUnit} to ${targetUnit}: ${e.message}`);
                }
            }

            // Labels: If no source unit, just assign the target unit (labeling mode)
            return PayloadUtils.createScalar(raw, targetUnit);
        } catch (e: any) {
            return PayloadUtils.createError(`Unit operation failed for ${targetUnit}`);
        }
    },
    // TR-02: Base Converter
    'TR-02': (node, inputs) => {
        const data = (node.data || {}) as any;
        const inputPayload = inputs['in_a'];
        if (!inputPayload) return PayloadUtils.createScalar(0);

        const metaUnit = inputPayload.meta?.unit?.toLowerCase();

        const baseMap: Record<string, number> = { 'bin': 2, 'quat': 4, 'oct': 8, 'dec': 10, 'duo': 12, 'hex': 16 };

        // Final Whitelist: Allow ONLY if Scalar OR explicit Base Unit
        const isScalar = inputPayload.type === DataType.Scalar;
        const hasBaseUnit = !!baseMap[metaUnit || ''];
        const isArray = inputPayload.type === DataType.Array || inputPayload.type === DataType.Matrix;

        if (isArray || (!isScalar && !hasBaseUnit)) {
            return PayloadUtils.createError("Base Conversion only supports scalar or base-prefixed strings.");
        }

        const unitMap: Record<number, string> = { 2: 'bin', 4: 'quat', 8: 'oct', 10: 'dec', 12: 'duo', 16: 'hex' };

        const fromBase = Number(data.fromBase || baseMap[metaUnit!] || 10);
        const toBase = Number(data.toBase || 16);
        const val = String(PayloadUtils.unwrap(inputPayload));

        try {
            const num = parseInt(val, fromBase);
            if (isNaN(num)) throw new Error('NaN');
            const resultStr = num.toString(toBase).toUpperCase();
            const outputUnit = unitMap[toBase] || 'scalar';

            return {
                ...PayloadUtils.createScalar(resultStr),
                meta: { unit: outputUnit }
            };
        } catch (e) { return PayloadUtils.createError('Base Conversion Failed'); }
    },
    // TR-06: Statistics
    'TR-06': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'Mean';
        const valPayload = inputs['in_a'];
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
            return PayloadUtils.createScalar(result);
        } catch (e: any) { return PayloadUtils.createError(`Stats Failed: ${e.message}`); }
    },
    // TR-05: Smoothing (2D Spatial Moving Average)
    'TR-05': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const dataPayload = inputs['in_a'];

        if (!dataPayload) return PayloadUtils.createError('Missing Input (data)');

        try {
            const raw = PayloadUtils.hydrate(PayloadUtils.unwrap(dataPayload), math);
            const windowMode = Number((node.data as any)?.windowMode || 3);
            const radius = Math.floor(windowMode / 2);

            // CASE 1: Scalar smoothing (Pass-through for now, as 2D filter needs context)
            if (dataPayload.type === DataType.Scalar) {
                return dataPayload;
            }

            // CASE 2: Array/Matrix smoothing (Unified 2D Blur)
            const matrix = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && (raw as any).isMatrix ? (raw as any).toArray() : [raw]);

            if (!Array.isArray(matrix)) return dataPayload;

            const is2D = Array.isArray(matrix[0]);
            const rows = matrix.length;
            const cols = is2D ? matrix[0].length : 1;

            const result = matrix.map((rowArr: any, r: number) => {
                const row = is2D ? rowArr : [rowArr];
                return row.map((_: any, c: number) => {
                    let sum = 0, count = 0;
                    for (let dr = -radius; dr <= radius; dr++) {
                        for (let dc = -radius; dc <= radius; dc++) {
                            const nr = r + dr;
                            const nc = c + dc;
                            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                                const val = is2D ? matrix[nr][nc] : (cols === 1 ? matrix[nr] : matrix[nr][nc]);
                                sum += Number(val);
                                count++;
                            }
                        }
                    }
                    return sum / count;
                });
            });

            // Restore original dimensionality
            const final = is2D ? result : result.map((r: any) => r[0]);
            return PayloadUtils.createArray(final);
        } catch (e) {
            return PayloadUtils.createError(String(e));
        }
    }
};

