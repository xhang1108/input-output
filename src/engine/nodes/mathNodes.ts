import { CalctopusEngine } from '../CalctopusEngine';
import { DataType, ASTNode } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NodeRegistry } from '../NodeRegistry';

export function registerMathNodes() {
    // MA-01: Standard Math Operators
    NodeRegistry.register('MA-01', (node, inputs) => {
        const engine = CalctopusEngine.getInstance();
        const mathInstance = engine.getMathInstance();

        const getHydrated = (key: string) => {
            const p = inputs[key];
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

        const valA = getHydrated('in_a');
        const valB = getHydrated('in_b');
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

            if (isUnitA && !isUnitB && mathInstance.equal(procB, 0)) procB = (mathInstance as any).unit(0, hA.formatUnits());
            else if (!isUnitA && isUnitB && mathInstance.equal(procA, 0)) procA = (mathInstance as any).unit(0, hB.formatUnits());
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
    }, (node, inputs) => {
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
    });

    // MA-03: Constants
    NodeRegistry.register('MA-03', (node) => {
        const math = CalctopusEngine.getInstance().getMathInstance() as any;
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
    }, (node) => PayloadUtils.createSymbol('Identifier', { name: ((node.data || {}) as any).val || 'pi' }));

    // MA-14: Rounding
    NodeRegistry.register('MA-14', (node, inputs) => {
        const math = CalctopusEngine.getInstance().getMathInstance() as any;
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
    }, (node, inputs) => {
        const data = (node.data || {}) as any;
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'round',
            args: [
                inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
                PayloadUtils.createSymbol('Literal', { value: data.precision ?? 0 })
            ]
        });
    });

    // MA-12: Fraction
    NodeRegistry.register('MA-12', (node, inputs) => {
        const math = CalctopusEngine.getInstance().getMathInstance() as any;
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
    }, (node, inputs) => PayloadUtils.createSymbol('FunctionCall', { name: 'fraction', args: [inputs['in']] }));

    // MA-02: Number Theory
    NodeRegistry.register('MA-02', (node, inputs) => {
        const math = CalctopusEngine.getInstance().getMathInstance() as any;
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
    }, (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'GCD';
        const funcMap: any = { GCD: 'gcd', LCM: 'lcm', MOD: 'mod', IS_PRIME: 'isPrime' };
        const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 })];
        if (op !== 'IS_PRIME') args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 }));
        return PayloadUtils.createSymbol('FunctionCall', { name: funcMap[op] || 'gcd', args });
    });

    // MA-15: Base Converter
    NodeRegistry.register('MA-15', (node, inputs) => {
        const data = (node.data || {}) as any;
        const inputPayload = inputs['in'];
        const targetBase = data.base || 'HEX';
        let finalValue = 0;
        if (inputPayload) {
            const raw = PayloadUtils.unwrap(inputPayload);
            if (typeof raw === 'number') finalValue = raw;
            else {
                const hydrated = PayloadUtils.hydrate(raw, CalctopusEngine.getInstance().getMathInstance());
                if (typeof hydrated === 'number') finalValue = hydrated;
                else if (hydrated && typeof hydrated === 'object' && 'toNumber' in hydrated) {
                    finalValue = (hydrated as any).toNumber((hydrated as any).isUnit ? undefined : '');
                }
            }
        }
        return { type: DataType.Scalar, value: finalValue, symbol: inputPayload?.symbol || null, meta: { unit: targetBase } };
    });

    // MA-16: Logarithm
    NodeRegistry.register('MA-16', (node, inputs) => {
        const math = CalctopusEngine.getInstance().getMathInstance() as any;
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
    }, (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.op || 'LN';
        if (op === 'LOG10') return PayloadUtils.createSymbol('FunctionCall', { name: 'log10', args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })] });
        if (op === 'LOG_N') return PayloadUtils.createSymbol('FunctionCall', { name: 'log', args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 }), inputs['base'] || PayloadUtils.createSymbol('Literal', { value: 10 })] });
        return PayloadUtils.createSymbol('FunctionCall', { name: 'log', args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })] });
    });
}
