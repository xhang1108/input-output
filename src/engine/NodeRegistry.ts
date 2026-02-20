import { NodeLogic } from './types';
import { MathEngine } from './MathEngine';
import { NodePayload, DataType, ASTNode } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';

/**
 * 💡 NodeRegistry: The Brain's Cortex
 * 
 * Manages the registration and execution of node evaluators and symbolizers.
 * Supports auto-propagation of symbolic ASTs for formula generation.
 */

type NodeEvaluator = (node: NodeLogic, inputs: Record<string, NodePayload>) => Promise<NodePayload> | NodePayload;
type NodeSymbolizer = (node: NodeLogic, inputs: Record<string, ASTNode>) => ASTNode;

export class NodeRegistry {
    private static evaluators: Map<string, NodeEvaluator> = new Map();
    private static symbolizers: Map<string, NodeSymbolizer> = new Map();

    public static register(type: string, evaluator: NodeEvaluator, symbolizer?: NodeSymbolizer) {
        this.evaluators.set(type, evaluator);
        if (symbolizer) {
            this.symbolizers.set(type, symbolizer);
        }
    }

    public static async evaluate(node: NodeLogic, inputs: Record<string, NodePayload>): Promise<NodePayload> {

        // Mute Bypass Logic: If muted, pass through the primary input
        const data = (node.data || {}) as Record<string, unknown>;
        if (data.muted) {
            const primaryInput = inputs['in'] || inputs['in_a'] || Object.values(inputs)[0];
            if (primaryInput) return primaryInput;
            return node.value || PayloadUtils.createScalar(0);
        }

        const evaluator = this.evaluators.get(node.type || 'baseNode');
        const result = evaluator ? await evaluator(node, inputs) : node.value;

        if (!result) return node.value || PayloadUtils.createScalar(0);

        // Auto-attach symbol if not already present
        if (result && typeof result === 'object' && result.symbol === null) {
            const inputSymbols: Record<string, ASTNode> = {};
            for (const [key, p] of Object.entries(inputs)) {
                if (p.symbol) {
                    inputSymbols[key] = p.symbol;
                } else {
                    // Fallback for unconnected or raw inputs: Literal of their value
                    const val = PayloadUtils.unwrap(p);
                    inputSymbols[key] = PayloadUtils.createSymbol('Literal', { value: (typeof val === 'object' ? 'Object' : val) as string | number | boolean | undefined });
                }
            }
            result.symbol = this.getSymbol(node, inputSymbols);
        }

        return result;
    }

    public static getSymbol(node: NodeLogic, inputs: Record<string, ASTNode>): ASTNode {
        const symbolizer = this.symbolizers.get(node.type || 'baseNode');

        if (symbolizer) {
            return symbolizer(node, inputs);
        }

        // Default Symbolizer: Identifier vs Literal
        const val = PayloadUtils.unwrap(node.value);
        const data = (node.data || {}) as Record<string, unknown>;
        const label = (data.label || data.name) as string | undefined;

        if (label) {
            return PayloadUtils.createSymbol('Identifier', { name: String(label), value: (typeof val === 'object' ? 'Complex' : val) as string | number | boolean | undefined });
        }
        return PayloadUtils.createSymbol('Literal', { value: (typeof val === 'object' ? 'Complex' : val) as string | number | boolean | undefined });
    }
}

// --- IO Nodes ---

// IO-01: Input (Scalar)
NodeRegistry.register('IO-01', (node) => node.value || PayloadUtils.createScalar(0), (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const name = data.label as string;
    const value = PayloadUtils.unwrap(node.value);
    return name
        ? PayloadUtils.createSymbol('Identifier', { name, value: value as string | number | boolean | undefined })
        : PayloadUtils.createSymbol('Literal', { value: value as string | number | boolean | undefined });
});

// IO-04: String Input
NodeRegistry.register('IO-04', (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const val = data.value !== undefined ? data.value : node.value;
    return PayloadUtils.createString(String(val));
}, (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    return PayloadUtils.createSymbol('Literal', { value: String(data.value || '') });
});

// IO-11: Result (Display)
NodeRegistry.register('IO-11', (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createScalar(0);
}, (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createSymbol('Literal', { value: 0 });
});

// IO-18: Color Picker
NodeRegistry.register('IO-18', (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const dataVal = data.value; // Set by UPDATE_NODE_DATA from UI
    const cachedVal = PayloadUtils.unwrap(node.value); // Previous evaluator output

    let hex = '#3b82f6';
    let rNorm = 0, gNorm = 0, bNorm = 0;

    // 1. Try data.value first (user input from RGB/Vec3 editing)
    if (dataVal && typeof dataVal === 'object' && !Array.isArray(dataVal) && 'vec3' in dataVal) {
        // User edited via channel inputs — { hex, vec3 } format
        const colorData = dataVal as { hex?: string; vec3?: number[] };
        hex = colorData.hex || '#000000';
        if (Array.isArray(colorData.vec3)) {
            [rNorm, gNorm, bNorm] = colorData.vec3;
        }
    } else if (typeof dataVal === 'string' && (dataVal.startsWith('#') || dataVal.length === 6)) {
        // User picked from color picker or manual input — normalize hex
        hex = dataVal.startsWith('#') ? dataVal : '#' + dataVal;
        rNorm = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
        gNorm = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
        bNorm = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
    } else if (cachedVal && typeof cachedVal === 'object' && !Array.isArray(cachedVal) && 'vec3' in cachedVal) {
        // Fallback to cached evaluator output (e.g. first render, undo/redo)
        const cVal = cachedVal as { hex?: string; vec3?: number[] };
        hex = cVal.hex || '#000000';
        if (Array.isArray(cVal.vec3)) {
            [rNorm, gNorm, bNorm] = cVal.vec3;
        }
    } else if (typeof cachedVal === 'string' && cachedVal.startsWith('#')) {
        hex = cachedVal;
        rNorm = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
        gNorm = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
        bNorm = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
    }
    // else: keep defaults (#3b82f6, 0,0,0)

    // 2. Bit Depth Scaling logic
    const depth = data.depth as string || '8bit';
    const scaler = depth === '10bit' ? 1023 : depth === '12bit' ? 4095 : 255;

    const rOut = Math.round(rNorm * scaler);
    const gOut = Math.round(gNorm * scaler);
    const bOut = Math.round(bNorm * scaler);

    return {
        type: DataType.Object,
        value: {
            hex: hex,
            rgb: [rOut, gOut, bOut],
            vec3: [rNorm, gNorm, bNorm]
        },
        symbol: null,
        meta: {
            role: 'color',
            handleMeta: {
                rgb: { role: 'color', unit: 'rgb' },
                vec3: { role: 'color', unit: 'vec3' }
            }
        }
    };
}, (node) => {
    const val = node.value || { value: '#ffffff' };
    const raw = PayloadUtils.unwrap(val) as any;
    return PayloadUtils.createSymbol('Literal', { value: raw?.hex || String(raw) });
});

// IO-19: Color Result (Display)
NodeRegistry.register('IO-19', (node, inputs) => {
    const payload = inputs['in'] || Object.values(inputs)[0];
    if (!payload) return PayloadUtils.createError('No input');

    const val = PayloadUtils.unwrap(payload);

    // If it's already a color object (from IO-18), pass it through
    if (val && typeof val === 'object' && !Array.isArray(val) && 'hex' in val) {
        return payload;
    }

    // Otherwise, try to interpret the input as a color (HEX string or RGB vector)
    let hex = '#000000';
    let r = 0, g = 0, b = 0;

    if (typeof val === 'string' && (val.startsWith('#') || val.length === 6)) {
        hex = val.startsWith('#') ? val : '#' + val;
        r = parseInt(hex.slice(1, 3), 16) || 0;
        g = parseInt(hex.slice(3, 5), 16) || 0;
        b = parseInt(hex.slice(5, 7), 16) || 0;
    } else if (Array.isArray(val) && val.length >= 3) {
        let vr = 0, vg = 0, vb = 0;
        let r = 0, g = 0, b = 0;

        // Determination Logic
        const depth = node.data?.depth || '8bit';
        const unit = payload.meta?.unit;

        // Helper to apply scaling
        const applyScale = (div: number) => {
            vr = (val as number[])[0] / div;
            vg = (val as number[])[1] / div;
            vb = (val as number[])[2] / div;
            r = Math.round(vr * 255);
            g = Math.round(vg * 255);
            b = Math.round(vb * 255);
        };

        if (unit === 'vec3') {
            // Already normalized (0-1)
            applyScale(1);
        } else if (depth === '10bit') {
            applyScale(1023);
        } else if (depth === '12bit') {
            applyScale(4095);
        } else {
            // Default to 8-bit (255)
            // Heuristic catch: if range implies 0-1, we might want to default to 1?
            // For now, strict 'vec3' unit is required for 0-1, otherwise we assume integer RGB.
            applyScale(255);
        }

        const toHex = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
        hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

        return {
            type: DataType.Object,
            value: {
                hex,
                rgb: [r, g, b],
                vec3: [vr, vg, vb]
            },
            symbol: null,
            meta: {}
        };
    }

    return {
        type: DataType.Object,
        value: {
            hex,
            rgb: [r, g, b],
            vec3: [Number((r / 255).toFixed(3)), Number((g / 255).toFixed(3)), Number((b / 255).toFixed(3))]
        },
        symbol: null,
        meta: {}
    };
});

// IO-16: Matrix View
NodeRegistry.register('IO-16', (node, inputs) => {
    // Pass-through payload for display
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createMatrix([]);
}, (node, inputs) => {
    return inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 'Matrix' });
});

// IO-05: Unit Assigner
NodeRegistry.register('IO-05', (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const inputPayload = inputs['in'] || PayloadUtils.createScalar(0);
    const val = PayloadUtils.unwrap(inputPayload);
    const unit = data.unit as string || 'm';
    const inputUnit = inputPayload.meta?.unit;

    const math = MathEngine.getInstance().getMathInstance();
    const hydratedInput = PayloadUtils.hydrate(val, math);

    let finalVal: number;
    const h = hydratedInput as { isBigNumber?: boolean; isUnit?: boolean; toNumber: () => number };
    if (typeof hydratedInput === 'number') {
        finalVal = hydratedInput;
    } else if (h && h.isBigNumber) {
        finalVal = h.toNumber();
    } else if (h && h.isUnit) {
        finalVal = h.toNumber();
    } else {
        finalVal = Number(hydratedInput);
    }

    if (inputUnit && inputUnit !== unit) {
        try {
            finalVal = MathEngine.getInstance().convertUnit(finalVal, inputUnit, unit);
        } catch (e) {
            return PayloadUtils.createError(`Cannot convert ${inputUnit} to ${unit}`);
        }
    }

    return PayloadUtils.createScalar(finalVal, unit);
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const inputSymbol = inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 });
    const targetUnit = data.unit as string;
    return { ...inputSymbol, unit: targetUnit };
});

// IO-02: Slider
NodeRegistry.register('IO-02', (node) => node.value || PayloadUtils.createScalar(0), (node) => {
    return PayloadUtils.createSymbol('Literal', { value: PayloadUtils.unwrap(node.value) as string | number | boolean | undefined });
});

// IO-06: Random
NodeRegistry.register('IO-06', (node) => {
    const engine = MathEngine.getInstance();
    const math = engine.getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'float';
    const rows = (data.rows as number) || 3;
    const cols = (data.cols as number) || 3;
    let result: unknown;

    try {
        const mathAny = math as unknown as Record<string, (v: unknown) => number>;
        const nMin = (data.min !== undefined && data.min !== null) ? Number(mathAny.number(data.min)) : 0;
        const nMax = (data.max !== undefined && data.max !== null) ? Number(mathAny.number(data.max)) : 1;
        const [realMin, realMax] = nMin <= nMax ? [nMin, nMax] : [nMax, nMin];
        const itemMode = data.itemMode || 'float';

        if (mode === 'matrix') {
            const size = [rows, cols];
            const mathM = math as unknown as Record<string, (s: number[], mi: number, ma: number) => unknown>;
            result = (itemMode === 'int')
                ? mathM.randomInt(size, realMin, realMax + 1)
                : mathM.random(size, realMin, realMax);
        } else {
            const mathS = math as unknown as Record<string, (mi: number, ma: number) => unknown>;
            result = (mode === 'int')
                ? mathS.randomInt(realMin, realMax + 1)
                : mathS.random(realMin, realMax);
        }

        // Always use BigNumber for random values in high precision mode
        if (typeof result === 'number') result = math.bignumber(result);
    } catch (e: unknown) {
        return PayloadUtils.createError('Random Failed');
    }

    return {
        type: mode === 'matrix' ? DataType.Matrix : DataType.Scalar,
        value: PayloadUtils.dehydrate(result),
        symbol: null,
        meta: {}
    };
}, (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'random',
        args: [
            PayloadUtils.createSymbol('Literal', { value: Number(data.min ?? 0) }),
            PayloadUtils.createSymbol('Literal', { value: Number(data.max ?? 1) })
        ]
    });
});

// IO-08: Matrix Input
NodeRegistry.register('IO-08', (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const raw = data.rawExpression as string || '[]';
    const math = MathEngine.getInstance().getMathInstance();
    // Re-hydrate matrix from raw expression if available, else zero
    try {
        return PayloadUtils.createMatrix(math.matrix(JSON.parse(raw)));
    } catch (e) {
        return PayloadUtils.createError('Invalid Matrix');
    }
}, (node) => {
    return PayloadUtils.createSymbol('Literal', { value: 'Matrix' });
});

// --- Math Nodes ---

// MA-01: Standard Math Operators
NodeRegistry.register('MA-01', (node, inputs) => {
    const engine = MathEngine.getInstance();
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

    // SPECIAL HANDLING: Color Objects (or other complex types)
    // If we receive a Color Object, extract its vector representation for math.
    // We prefer 'vec3' (normalized) for math, but if user specifically wants RGB math, we might need a setting.
    // For now, let's default to extracting 'vec3' if available.

    // Helper to unwrap complex objects for math
    const extractValue = (v: unknown) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            const obj = v as Record<string, unknown>;
            if (!obj.isMatrix && !obj.isUnit && !obj.isBigNumber) {
                if ('vec3' in obj) return obj.vec3; // Color Object -> vec3
                if ('value' in obj) return obj.value; // Generic Wrapper
            }
        }
        return v;
    };

    let procA = extractValue(valA);
    let procB = extractValue(valB);

    // SCIENCE MODE: Enforce BigNumber if configured
    // PRECISION POLICY: Always promote to BigNumber for high precision.
    // This unifies the engine behavior (formerly "Scientific Mode").
    const toBig = (v: unknown) => {
        if (typeof v === 'number') return (mathInstance as unknown as { bignumber: (n: number) => unknown }).bignumber(v);
        return v;
    };
    procA = toBig(procA);
    procB = toBig(procB);

    // DEBUG LOGGING
    if (op === 'MUL') {
        console.log('MA-01 MUL Debug:', { procA, procB, typeA: typeof procA });
    }

    if (op === 'ADD' || op === 'SUB') {
        const hA = procA as { isUnit?: boolean; formatUnits: () => string; isMatrix?: boolean };
        const hB = procB as { isUnit?: boolean; formatUnits: () => string; isMatrix?: boolean };

        const isUnitA = hA && (hA.isUnit || (hA as { constructor?: { name: string } }).constructor?.name === 'Unit');
        const isUnitB = hB && (hB.isUnit || (hB as { constructor?: { name: string } }).constructor?.name === 'Unit');

        const isMatrixA = hA && (Array.isArray(hA) || hA.isMatrix || (hA as { constructor?: { name: string } }).constructor?.name === 'Matrix');
        const isMatrixB = hB && (Array.isArray(hB) || hB.isMatrix || (hB as { constructor?: { name: string } }).constructor?.name === 'Matrix');

        if ((isMatrixA && !isMatrixB) || (!isMatrixA && isMatrixB)) {
            return PayloadUtils.createError("Strict Mode: Cannot add/sub Matrix and Scalar");
        }

        const m = mathInstance as {
            equal: (a: unknown, b: unknown) => boolean;
            unit: (v: unknown, u: unknown) => unknown;
        };

        if (isUnitA && !isUnitB && m.equal(procB, 0)) procB = m.unit(0, hA.formatUnits());
        else if (!isUnitA && isUnitB && m.equal(procA, 0)) procA = m.unit(0, hB.formatUnits());
    }

    try {
        const m = (mathInstance as unknown) as Record<string, (...args: unknown[]) => unknown>;
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

        // Propagate Metadata
        // If inputs had 'role: color', preserve it?
        const metaA = inputs['in_a']?.meta || {};
        const metaB = inputs['in_b']?.meta || {};
        const combinedMeta: Record<string, unknown> = {};

        if (finalUnit) combinedMeta.unit = finalUnit;
        else {
            // Manual Unit Propagation for Arrays or complex types (where mathjs didn't return a Unit object)
            // If inputs share a unit, propagate it.
            // If only one has a unit, propagate it (unless op implies unit change? ADD/SUB requires match, MUL doesn't)
            // For now, simple inheritance:
            if (metaA.unit && metaB.unit && metaA.unit === metaB.unit) {
                combinedMeta.unit = metaA.unit;
            } else if (metaA.unit && !metaB.unit) {
                combinedMeta.unit = metaA.unit;
            } else if (!metaA.unit && metaB.unit) {
                combinedMeta.unit = metaB.unit;
            }
        }

        if (result && typeof result === 'object') {
            const obj = result as { isUnit?: boolean; constructor: { name: string }; formatUnits: () => string; toNumber: (u: string) => number; value: unknown };
            if (obj.isUnit || obj.constructor.name === 'Unit') {
                finalUnit = obj.formatUnits();
                try { finalValue = obj.toNumber(finalUnit); } catch (e) { finalValue = obj.value; }
                return {
                    ...PayloadUtils.createScalar(PayloadUtils.dehydrate(finalValue), finalUnit),
                    meta: { ...combinedMeta, unit: finalUnit }
                };
            }
        }

        // Auto-wrap result with metadata
        return {
            ...PayloadUtils.wrap(result),
            meta: combinedMeta
        };
    } catch (e: unknown) {
        const err = e as Error;
        let msg = err.message;
        if (msg.includes('Dimension mismatch')) {
            if (op === 'ADD' || op === 'SUB') msg = `Size Mismatch: Cannot ${op === 'ADD' ? 'Add' : 'Subtract'} different sized matrices`;
            else if (op === 'MUL') msg = `Size Mismatch: Cols A must match Rows B`;
            else if (op === 'DIV') msg = `Matrix Division is not supported`;
        } else if (msg.includes('Units do not match')) {
            msg = `Unit Mismatch: Cannot combine different physical quantities`;
        }
        return PayloadUtils.createError(msg);
    }
}, (node, inputs) => {
    const op = ((node.data || {}) as Record<string, unknown>).op as string || 'ADD';
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
    const mathResult = MathEngine.getInstance().getMathInstance() as unknown;
    const math = mathResult as Record<string, unknown>;
    const data = (node.data || {}) as Record<string, unknown>;
    const label = data.val as string || 'pi';
    let value: unknown = math[label] ?? (label === 'Infinity' ? Infinity : 0);

    const precision = data.precision as number | undefined;
    if (precision !== undefined && precision !== -1) {
        const m = math as unknown as Record<string, (v: unknown, p: number) => unknown>;
        value = m.round(value, precision) as unknown;
    }

    const valToDehydrate = value as Record<string, unknown>;
    return {
        type: DataType.Scalar,
        value: PayloadUtils.dehydrate(valToDehydrate),
        symbol: null,
        meta: {}
    };
}, (node) => PayloadUtils.createSymbol('Identifier', { name: ((node.data || {}) as Record<string, unknown>).val as string || 'pi' }));

// IO-17: Formula Result (Consolidated)
// (Implementation moved to end or handled here)

// MA-14: Rounding (Moved from MA-12)
NodeRegistry.register('MA-14', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const valPayload = inputs['in_a'] || PayloadUtils.createScalar(0);
    const data = (node.data || {}) as Record<string, unknown>;
    const prec = data.precision as number ?? 0;

    const val = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);

    try {
        const m = math as unknown as Record<string, (v: unknown, p: number) => unknown>;
        const result = m.round(val, prec);
        return {
            type: DataType.Scalar,
            value: PayloadUtils.dehydrate(result),
            symbol: null,
            meta: { unit: valPayload.meta?.unit }
        };
    } catch (e: unknown) {
        return PayloadUtils.createError('Op Failed');
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'round',
        args: [
            inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
            PayloadUtils.createSymbol('Literal', { value: (data.precision as number) ?? 0 })
        ]
    });
});

// MA-12: Fraction
NodeRegistry.register('MA-12', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const raw = PayloadUtils.unwrap(inputs['in']);
    const data = (node.data || {}) as Record<string, unknown>;
    const isMixed = data.mixed === true;

    try {
        if (raw === null || raw === undefined) return PayloadUtils.createScalar(0);
        const m = math as unknown as Record<string, (v: number) => { n: unknown, d: unknown }>;
        const f = m.fraction(raw as number);
        let n = Number(f.n);
        const d = Number(f.d);
        let integerPart = 0;
        let str = math.format(f);

        if (isMixed && d !== 0) {
            integerPart = Math.floor(n / d);
            const remainder = n % d;

            if (integerPart !== 0) {
                n = remainder;
                if (n === 0) {
                    str = `${integerPart}`;
                } else {
                    str = `${integerPart} ${n}/${d}`;
                }
            }
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
    } catch (e) {
        return PayloadUtils.createError('Invalid Fraction');
    }
}, (node, inputs) => {
    return PayloadUtils.createSymbol('FunctionCall', { name: 'fraction', args: [inputs['in']] });
});

// MA-02: Number Theory
NodeRegistry.register('MA-02', (node, inputs) => {
    const engine = MathEngine.getInstance();
    const math = engine.getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'GCD';

    const getVal = (key: string) => {
        const p = inputs[key];
        if (!p) return 0;
        const val = PayloadUtils.unwrap(p);
        const hydrated = PayloadUtils.hydrate(val, math);
        // Handle Units if necessary (for now, strip units or use scalar)
        const h = hydrated as { isBigNumber?: boolean; toNumber?: () => number };
        if (p.meta?.unit && (typeof hydrated === 'number' || (h && h.isBigNumber))) {
            try { return h.toNumber ? h.toNumber() : Number(hydrated); } catch (e) { return 0; }
        }
        return hydrated;
    };

    const valA = getVal('in_a');

    // For IsPrime, we only need A. For others, we need A and B.
    const valB = getVal('in_b');

    console.log('[NumberTheory] Execution:', { op, valA, valB, inputs });

    try {
        let result: unknown;
        const m = (math as unknown) as Record<string, (...args: unknown[]) => unknown>;
        switch (op) {
            case 'GCD': result = m.gcd(valA, valB); break;
            case 'LCM': result = m.lcm(valA, valB); break;
            case 'MOD': result = m.mod(valA, valB); break;
            case 'IS_PRIME': result = m.isPrime(valA); break;
            default: result = 0;
        }

        if (op === 'IS_PRIME') {
            return PayloadUtils.createBoolean(!!result);
        }

        // Convert BigNumber to number for display, similar into MA-01
        let finalValue = result;
        if (result && typeof result === 'object') {
            const obj = result as { isBigNumber?: boolean; toNumber: () => number };
            if (obj.isBigNumber) {
                finalValue = obj.toNumber();
            }
        }

        const payload = {
            type: DataType.Scalar,
            value: PayloadUtils.dehydrate(finalValue),
            symbol: null,
            meta: {}
        };
        return payload;
    } catch (e: unknown) {
        const err = e as Error;
        return PayloadUtils.createError(`${op} Failed: ${err.message}`);
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'GCD';
    const funcMap: Record<string, string> = {
        GCD: 'gcd', LCM: 'lcm', MOD: 'mod', IS_PRIME: 'isPrime'
    };

    const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 })];
    if (op !== 'IS_PRIME') {
        args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 }));
    }

    return PayloadUtils.createSymbol('FunctionCall', {
        name: funcMap[op] || 'gcd',
        args: args
    });
});

// UI-01: Text Annotation (No-op)
NodeRegistry.register('UI-01', (node, inputs) => {
    return {
        type: DataType.Object,
        value: {},
        symbol: null,
        meta: {}
    };
});

// UI-03: Reroute (Identity)
NodeRegistry.register('UI-03', (node, inputs) => {
    // Pass-through input 'in' to output 'out' (implied by return value)
    const val = inputs['in'] ? PayloadUtils.clone(inputs['in']) : PayloadUtils.createScalar(0);
    return val;
}, (node, inputs) => {
    return inputs['in'] || null;
});

// UI-99: Debug Node
NodeRegistry.register('UI-99', (node, inputs) => {
    // Pass-through input for inspection
    return inputs['in'] || PayloadUtils.createScalar(0);
}, (node, inputs) => {
    return inputs['in'] || null;
});


// --- Logic Nodes ---


// MA-15: Base Converter
NodeRegistry.register('MA-15', (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const inputPayload = inputs['in'] as import('../types/payload').NodePayload | undefined;
    const targetBase = (data.base as string) || 'HEX';

    // Default to 0
    let finalValue: number = 0;

    if (inputPayload) {
        // Unwrap and Normalize to Number
        const raw = PayloadUtils.unwrap(inputPayload);
        // If it's a simple number, use it.
        if (typeof raw === 'number') {
            finalValue = raw;
        } else {
            // Use MathEngine to handle Units/BigNumbers
            const engine = MathEngine.getInstance();
            const math = engine.getMathInstance();
            const hydrated = PayloadUtils.hydrate(raw, math);

            if (typeof hydrated === 'number') {
                finalValue = hydrated;
            } else if (hydrated && typeof hydrated === 'object') {
                // Check for Unit, BigNumber, etc.
                const h = hydrated as { toNumber?: (u?: string) => number; value?: number; isUnit?: boolean };
                if (h.toNumber) {
                    try {
                        // verify if it is Unit
                        if (h.isUnit) {
                            finalValue = h.toNumber(h.isUnit ? undefined : ''); // toNumber() with no args for base scalar
                        } else {
                            finalValue = h.toNumber();
                        }
                    } catch (e) {
                        finalValue = 0; // Fallback
                    }
                } else if (h.value !== undefined && typeof h.value === 'number') {
                    finalValue = h.value;
                }
            }
        }
    }

    const resultPayload = {
        type: DataType.Scalar, // Always return Scalar for base conversion
        value: finalValue,
        symbol: inputPayload ? inputPayload.symbol : null,
        meta: {
            unit: targetBase
        }
    };

    return resultPayload;
});

// MA-16: Logarithm
NodeRegistry.register('MA-16', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const valPayload = inputs['in'] || PayloadUtils.createScalar(0);
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'LN';

    const val = PayloadUtils.unwrap(valPayload);
    const hVal = PayloadUtils.hydrate(val, math);

    try {
        const m = math as unknown as Record<string, (v: unknown, b?: unknown) => unknown>;
        let result: unknown;

        if (op === 'LOG10') {
            result = m.log10(hVal);
        } else if (op === 'LOG_N') {
            const basePayload = inputs['base'];
            let base = basePayload ? PayloadUtils.hydrate(PayloadUtils.unwrap(basePayload), math) : 10;
            result = m.log(hVal, base);
        } else {
            result = m.log(hVal);
        }

        return {
            type: DataType.Scalar,
            value: PayloadUtils.dehydrate(result),
            symbol: null,
            meta: {}
        };
    } catch (e: unknown) {
        return PayloadUtils.createError('Log Failed');
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'LN';

    if (op === 'LOG10') {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'log10',
            args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })]
        });
    } else if (op === 'LOG_N') {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'log',
            args: [
                inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
                inputs['base'] || PayloadUtils.createSymbol('Literal', { value: 10 })
            ]
        });
    } else {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'log',
            args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })]
        });
    }
});

// MA-05: Logic Gate (AND, OR, NOT, XOR, NAND, NOR, XNOR)
NodeRegistry.register('MA-05', (node, inputs) => {
    const engine = MathEngine.getInstance();
    const math = engine.getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'AND';

    const getVal = (key: string) => {
        const p = inputs[key];
        if (!p) return null;
        // Hydrate to ensure we have comparable mathjs objects (BigNumber, Unit) or primitives
        const raw = PayloadUtils.unwrap(p);
        const hydrated = PayloadUtils.hydrate(raw, math);

        // MA-01 Style: Re-attach unit if available and not already a Unit object
        if (p.meta?.unit && (typeof hydrated === 'number' || (hydrated && typeof hydrated === 'object' && 'isBigNumber' in hydrated))) {
            try { return math.unit(hydrated as number, p.meta.unit); } catch (e) { return hydrated; }
        }
        return hydrated;
    };

    const valA = getVal('in_a');
    const valB = getVal('in_b');

    // Bool conversion helper (loosely truthy)
    const toBool = (v: unknown) => PayloadUtils.toBoolean(v, math);

    try {
        const m = math as unknown as Record<string, (a: unknown, b: unknown) => unknown>;
        let result: boolean;
        switch (op) {
            // Comparisons
            // Note: math.larger and friends work with Units, BigNumbers, etc.
            case 'GT': result = m.larger(valA, valB) as boolean; break;
            case 'LT': result = m.smaller(valA, valB) as boolean; break;
            case 'GTE': result = m.largerEq(valA, valB) as boolean; break;
            case 'LTE': result = m.smallerEq(valA, valB) as boolean; break;
            case 'NEQ': result = !m.equal(valA, valB) as boolean; break;
            case 'EQ': result = m.equal(valA, valB) as boolean; break;

            // Boolean Gates
            case 'NOT': result = !toBool(valA); break;
            case 'AND': result = toBool(valA) && toBool(valB); break;
            case 'OR': result = toBool(valA) || toBool(valB); break;
            case 'XOR': result = (toBool(valA) !== toBool(valB)); break;

            default: result = false;
        }
        return PayloadUtils.createBoolean(result);
    } catch (e) {
        // If comparison fails (e.g. incompatible units), return Error
        return PayloadUtils.createError(`${op} Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'AND';
    const ops: Record<string, string> = {
        EQ: '==', GT: '>', LT: '<', GTE: '>=', LTE: '<=', NEQ: '!=',
        AND: '&&', OR: '||'
    };

    if (op === 'NOT') {
        return PayloadUtils.createSymbol('UnaryExpression', {
            operator: '!',
            argument: inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: false })
        });
    }

    if (['AND', 'OR'].includes(op) || ops[op]) {
        return PayloadUtils.createSymbol('BinaryExpression', {
            operator: ops[op] || op,
            left: inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
            right: inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 })
        });
    }

    return PayloadUtils.createSymbol('Literal', { value: 'Logic' });
});

// MA-13: Logic Split
NodeRegistry.register('MA-13', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const condition = PayloadUtils.toBoolean(inputs['condition'], math);
    const data = inputs['data'] || PayloadUtils.createScalar(0);

    return {
        type: DataType.Object,
        value: {
            out_true: condition ? data : null,
            out_false: !condition ? data : null
        },
        symbol: null,
        meta: {
            handleMeta: {
                out_true: data.meta,
                out_false: data.meta
            }
        }
    };
});

// MA-04: Switch
NodeRegistry.register('MA-04', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const condition = PayloadUtils.toBoolean(inputs['condition'], math);
    const valTrue = inputs['in_true'];
    const valFalse = inputs['in_false'];

    const result = condition ? valTrue : valFalse;
    return result || PayloadUtils.createError('No Input');
}, (node, inputs) => {
    return PayloadUtils.createSymbol('ConditionalExpression', {
        test: inputs['condition'] || PayloadUtils.createSymbol('Literal', { value: false }),
        consequent: inputs['in_true'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
        alternate: inputs['in_false'] || PayloadUtils.createSymbol('Literal', { value: 0 })
    });
});

// MA-08: Toggle
NodeRegistry.register('MA-08', (node) => {
    return PayloadUtils.createBoolean(!!PayloadUtils.unwrap(node.value));
}, (node) => {
    return PayloadUtils.createSymbol('Literal', { value: !!PayloadUtils.unwrap(node.value) });
});

// MA-09: Button
NodeRegistry.register('MA-09', (node) => {
    return PayloadUtils.createBoolean(!!PayloadUtils.unwrap(node.value));
}, (node) => {
    return PayloadUtils.createSymbol('Literal', { value: !!PayloadUtils.unwrap(node.value) });
});


// IO-17: Formula Result
NodeRegistry.register('IO-17', (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createScalar(0);
}, (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createSymbol('Literal', { value: 0 });
});

// UI-01: Text Annotation
NodeRegistry.register('UI-01', (node, inputs) => {
    return {
        type: DataType.Object,
        value: {},
        symbol: null,
        meta: {}
    };
}, (node) => {
    return PayloadUtils.createSymbol('Literal', { value: 'Annotation' });
});

// SY-05: Expert Node (NodeExpression)
NodeRegistry.register('SY-05', (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const code = (data.code as string) || '';
    if (!code) return PayloadUtils.createScalar(0);

    const math = MathEngine.getInstance().getMathInstance();
    try {
        const scope: Record<string, any> = {};
        for (const [key, val] of Object.entries(inputs)) {
            const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(val), math);
            scope[key] = hydrated;
        }

        const result = math.evaluate(code, scope);
        return {
            type: DataType.Scalar,
            value: PayloadUtils.dehydrate(result),
            symbol: null,
            meta: {}
        };
    } catch (error) {
        return PayloadUtils.createError(String(error));
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const code = (data.code as string) || '';
    if (!code) return PayloadUtils.createSymbol('Literal', { value: 0 });

    const math = MathEngine.getInstance().getMathInstance();
    try {
        const parsed = math.parse(code);
        const convert = (mNode: any): any => {
            if (mNode.isSymbolNode) {
                return inputs[mNode.name] || PayloadUtils.createSymbol('Identifier', { name: mNode.name });
            }
            if (mNode.isOperatorNode) {
                const opMap: Record<string, string> = {
                    '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV', '^': 'POW'
                };
                if (mNode.args.length === 2) {
                    return PayloadUtils.createSymbol('BinaryExpression', {
                        operator: opMap[mNode.op] || mNode.op,
                        left: convert(mNode.args[0]),
                        right: convert(mNode.args[1])
                    });
                } else if (mNode.args.length === 1) {
                    return PayloadUtils.createSymbol('UnaryExpression', {
                        operator: mNode.op === '-' ? 'NEG' : mNode.op,
                        argument: convert(mNode.args[0])
                    });
                }
            }
            if (mNode.isConstantNode) {
                return PayloadUtils.createSymbol('Literal', { value: mNode.value });
            }
            if (mNode.isFunctionNode) {
                return PayloadUtils.createSymbol('FunctionCall', {
                    name: mNode.name,
                    args: mNode.args.map(convert)
                });
            }
            if (mNode.isParenthesisNode) {
                return convert(mNode.content);
            }
            return PayloadUtils.createSymbol('Literal', { value: mNode ? String(mNode) : '?' });
        };
        return convert(parsed);
    } catch (e) {
        return PayloadUtils.createSymbol('Literal', { value: code });
    }
});
