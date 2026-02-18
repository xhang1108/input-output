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
        if (node.data?.muted) {
            const primaryInput = inputs['in'] || inputs['in_a'] || Object.values(inputs)[0];
            if (primaryInput) return primaryInput;
            return node.value || PayloadUtils.createScalar(0);
        }

        const evaluator = this.evaluators.get(node.type || 'baseNode');
        const result = evaluator ? await evaluator(node, inputs) : node.value;

        // Auto-attach symbol if not already present
        if (result && typeof result === 'object' && result.symbol === null) {
            const inputSymbols: Record<string, ASTNode> = {};
            for (const [key, p] of Object.entries(inputs)) {
                if (p.symbol) {
                    inputSymbols[key] = p.symbol;
                } else {
                    // Fallback for unconnected or raw inputs: Literal of their value
                    const val = PayloadUtils.unwrap(p);
                    inputSymbols[key] = PayloadUtils.createSymbol('Literal', { value: typeof val === 'object' ? 'Object' : val });
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
        const label = node.data?.label || node.data?.name;

        if (label) {
            return PayloadUtils.createSymbol('Identifier', { name: String(label), value: typeof val === 'object' ? 'Complex' : val });
        }
        return PayloadUtils.createSymbol('Literal', { value: typeof val === 'object' ? 'Complex' : val });
    }
}

// --- IO Nodes ---

// IO-01: Input (Scalar)
NodeRegistry.register('IO-01', (node) => node.value, (node) => {
    const name = node.data.label as string;
    const value = PayloadUtils.unwrap(node.value);
    return name
        ? PayloadUtils.createSymbol('Identifier', { name, value })
        : PayloadUtils.createSymbol('Literal', { value });
});

// IO-04: String Input
NodeRegistry.register('IO-04', (node) => {
    const val = node.data.value !== undefined ? node.data.value : node.value;
    return PayloadUtils.createString(String(val));
}, (node) => {
    return PayloadUtils.createSymbol('Literal', { value: String(node.data.value || '') });
});

// IO-11: Result (Display)
NodeRegistry.register('IO-11', (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createScalar(0);
}, (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createSymbol('Literal', { value: 0 });
});

// IO-18: Color Picker
NodeRegistry.register('IO-18', (node) => {
    // Priority: node.data.value (fresh user input from UPDATE_NODE_DATA)
    //           > node.value (cached evaluator output)
    //           > default fallback
    const dataVal = node.data?.value; // Set by UPDATE_NODE_DATA from UI
    const cachedVal = PayloadUtils.unwrap(node.value); // Previous evaluator output

    let hex = '#3b82f6';
    let rNorm = 0, gNorm = 0, bNorm = 0;

    // 1. Try data.value first (user input from RGB/Vec3 editing)
    if (dataVal && typeof dataVal === 'object' && !Array.isArray(dataVal) && 'vec3' in dataVal) {
        // User edited via channel inputs — { hex, vec3 } format
        hex = dataVal.hex || '#000000';
        if (Array.isArray(dataVal.vec3)) {
            [rNorm, gNorm, bNorm] = dataVal.vec3;
        }
    } else if (typeof dataVal === 'string' && dataVal.startsWith('#')) {
        // User picked from color picker — raw hex string
        hex = dataVal;
        rNorm = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
        gNorm = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
        bNorm = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
    } else if (cachedVal && typeof cachedVal === 'object' && !Array.isArray(cachedVal) && 'vec3' in cachedVal) {
        // Fallback to cached evaluator output (e.g. first render, undo/redo)
        hex = cachedVal.hex || '#000000';
        if (Array.isArray(cachedVal.vec3)) {
            [rNorm, gNorm, bNorm] = cachedVal.vec3;
        }
    } else if (typeof cachedVal === 'string' && cachedVal.startsWith('#')) {
        hex = cachedVal;
        rNorm = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
        gNorm = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
        bNorm = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
    }
    // else: keep defaults (#3b82f6, 0,0,0)

    // 2. Bit Depth Scaling logic
    const depth = node.data?.depth || '8bit';
    const scaler = depth === '10bit' ? 1023 : depth === '12bit' ? 4095 : 255;

    const rOut = Math.round(rNorm * scaler);
    const gOut = Math.round(gNorm * scaler);
    const bOut = Math.round(bNorm * scaler);

    return {
        type: DataType.Object,
        value: {
            hex: hex,
            rgb: [rOut, gOut, bOut],
            vec3: [rNorm, gNorm, bNorm] // Preserve infinite precision
        },
        symbol: null,
        meta: {
            role: 'color',
            handleMeta: {
                // 'rgb' handle uses 'rgb' unit (integer range depends on depth)
                rgb: { role: 'color', unit: 'rgb' },
                // 'vec3' handle uses 'vec3' unit (0-1)
                vec3: { role: 'color', unit: 'vec3' }
            }
        }
    };
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
            vr = val[0] / div;
            vg = val[1] / div;
            vb = val[2] / div;
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
    const inputPayload = inputs['in'] || PayloadUtils.createScalar(0);
    const val = PayloadUtils.unwrap(inputPayload);
    const unit = node.data?.unit as string || 'm';
    const inputUnit = inputPayload.meta?.unit;

    const math = MathEngine.getInstance().getMathInstance();
    const hydratedInput = PayloadUtils.hydrate(val, math);

    let finalVal: number;
    if (typeof hydratedInput === 'number') {
        finalVal = hydratedInput;
    } else if (hydratedInput && hydratedInput.isBigNumber) {
        finalVal = hydratedInput.toNumber();
    } else if (hydratedInput && hydratedInput.isUnit) {
        finalVal = hydratedInput.toNumber();
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
    const inputSymbol = inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 });
    const targetUnit = node.data?.unit as string;
    return { ...inputSymbol, unit: targetUnit };
});

// IO-02: Slider
NodeRegistry.register('IO-02', (node) => node.value, (node) => {
    return PayloadUtils.createSymbol('Literal', { value: PayloadUtils.unwrap(node.value) });
});

// IO-06: Random
NodeRegistry.register('IO-06', (node) => {
    const engine = MathEngine.getInstance();
    const math = engine.getMathInstance();
    const data = node.data || {};
    const mode = data.mode || 'float';
    const rows = data.rows || 3;
    const cols = data.cols || 3;
    let result: any;

    try {
        const nMin = (data.min !== undefined && data.min !== null) ? Number(math.number(data.min)) : 0;
        const nMax = (data.max !== undefined && data.max !== null) ? Number(math.number(data.max)) : 1;
        const [realMin, realMax] = nMin <= nMax ? [nMin, nMax] : [nMax, nMin];
        const itemMode = data.itemMode || 'float';

        if (mode === 'matrix') {
            const size = [rows, cols];
            result = (itemMode === 'int')
                ? math.randomInt(size, realMin, realMax + 1)
                : math.random(size, realMin, realMax);
        } else {
            result = (mode === 'int')
                ? math.randomInt(realMin, realMax + 1)
                : math.random(realMin, realMax);
        }

        const isBigNumber = engine.getComputationMode() === 'scientific';
        if (isBigNumber && typeof result === 'number') result = math.bignumber(result);
    } catch (e) {
        return PayloadUtils.createError('Random Failed');
    }

    return {
        type: mode === 'matrix' ? DataType.Matrix : DataType.Scalar,
        value: PayloadUtils.dehydrate(result),
        symbol: null,
        meta: {}
    };
}, (node) => {
    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'random',
        args: [
            PayloadUtils.createSymbol('Literal', { value: node.data.min ?? 0 }),
            PayloadUtils.createSymbol('Literal', { value: node.data.max ?? 1 })
        ]
    });
});

// IO-08: Matrix Input
NodeRegistry.register('IO-08', (node) => {
    const math = MathEngine.getInstance().getMathInstance();
    // Re-hydrate matrix from raw expression if available, else zero
    const raw = node.data.rawExpression ? JSON.parse(node.data.rawExpression as string) : [[0]];
    try {
        return PayloadUtils.createMatrix(math.matrix(raw));
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
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(p), mathInstance);
        if (p.meta?.unit && (typeof hydrated === 'number' || (hydrated && hydrated.isBigNumber))) {
            try { return mathInstance.unit(hydrated, p.meta.unit); } catch (e) { return hydrated; }
        }
        return hydrated;
    };

    const valA = getHydrated('in_a');
    const valB = getHydrated('in_b');
    const op = node.data?.op || 'ADD';

    // SPECIAL HANDLING: Color Objects (or other complex types)
    // If we receive a Color Object, extract its vector representation for math.
    // We prefer 'vec3' (normalized) for math, but if user specifically wants RGB math, we might need a setting.
    // For now, let's default to extracting 'vec3' if available.

    // Helper to unwrap complex objects for math
    const extractValue = (v: any) => {
        if (v && typeof v === 'object' && !Array.isArray(v) && !v.isMatrix && !v.isUnit && !v.isBigNumber) {
            if ('vec3' in v) return v.vec3; // Color Object -> vec3
            if ('value' in v) return v.value; // Generic Wrapper
        }
        return v;
    };

    let procA = extractValue(valA);
    let procB = extractValue(valB);

    // DEBUG LOGGING
    if (op === 'MUL') {
        console.log('MA-01 MUL Debug:', { procA, procB, typeA: typeof procA });
    }

    if (op === 'ADD' || op === 'SUB') {
        const isUnitA = procA && (procA.isUnit || procA.constructor.name === 'Unit');
        const isUnitB = procB && (procB.isUnit || procB.constructor.name === 'Unit');

        // STRICT MODE: Check for Matrix <-> Scalar mismatch
        const isMatrixA = procA && (Array.isArray(procA) || procA.isMatrix || procA.constructor.name === 'Matrix');
        const isMatrixB = procB && (Array.isArray(procB) || procB.isMatrix || procB.constructor.name === 'Matrix');

        if ((isMatrixA && !isMatrixB) || (!isMatrixA && isMatrixB)) {
            return PayloadUtils.createError("Strict Mode: Cannot add/sub Matrix and Scalar");
        }

        if (isUnitA && !isUnitB && mathInstance.equal(procB, 0)) procB = mathInstance.unit(0, procA.formatUnits());
        else if (!isUnitA && isUnitB && mathInstance.equal(procA, 0)) procA = mathInstance.unit(0, procB.formatUnits());
    }

    try {
        const fn = op === 'ADD' ? 'add' : op === 'SUB' ? 'subtract' : op === 'MUL' ? 'multiply' : 'divide';
        const result = mathInstance[fn](procA, procB);
        let finalValue = result;
        let finalUnit: string | undefined;

        // Propagate Metadata
        // If inputs had 'role: color', preserve it?
        const metaA = inputs['in_a']?.meta || {};
        const metaB = inputs['in_b']?.meta || {};
        const combinedMeta: any = {};

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

        if (result && typeof result === 'object' && ('isUnit' in result || result.constructor.name === 'Unit')) {
            const unitResult = result as any;
            if (unitResult.isUnit || unitResult.constructor.name === 'Unit') {
                finalUnit = unitResult.formatUnits();
                try { finalValue = unitResult.toNumber(finalUnit); } catch (e) { finalValue = unitResult.value; }
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
    } catch (e: any) {
        let msg = e.message;
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
    return PayloadUtils.createSymbol('BinaryExpression', {
        operator: node.data?.op || 'ADD',
        left: inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
        right: inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 })
    });
});

// MA-03: Constants
NodeRegistry.register('MA-03', (node) => {
    const math = MathEngine.getInstance().getMathInstance();
    const label = node.data.val as string || 'pi';
    let value = (math as any)[label] ?? (label === 'Infinity' ? Infinity : 0);

    const precision = node.data.precision as number | undefined;
    if (precision !== undefined && precision !== -1) {
        value = math.round(value, precision);
    }

    return {
        type: DataType.Scalar,
        value: PayloadUtils.dehydrate(value),
        symbol: null,
        meta: {}
    };
}, (node) => PayloadUtils.createSymbol('Identifier', { name: node.data.val || 'pi' }));

// IO-17: Formula Result
NodeRegistry.register('IO-17', (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createScalar(0);
});

// MA-14: Rounding (Moved from MA-12)
NodeRegistry.register('MA-14', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const valPayload = inputs['in_a'] || PayloadUtils.createScalar(0);
    const prec = node.data.precision as number ?? 0;

    const val = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);

    try {
        const result = math.round(val, prec);
        return {
            type: DataType.Scalar,
            value: PayloadUtils.dehydrate(result),
            symbol: null,
            meta: { unit: valPayload.meta?.unit }
        };
    } catch (e) {
        return PayloadUtils.createError('Round Failed');
    }
}, (node, inputs) => {
    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'round',
        args: [
            inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
            PayloadUtils.createSymbol('Literal', { value: node.data.precision ?? 0 })
        ]
    });
});

// MA-12: Fraction
NodeRegistry.register('MA-12', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const raw = PayloadUtils.unwrap(inputs['in']);

    const isMixed = node.data.mixed === true;

    try {
        if (raw === null || raw === undefined) return PayloadUtils.createScalar(0);
        const f = math.fraction(raw);
        let n = Number((f as any).n);
        let d = Number((f as any).d);
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
    const op = node.data?.op || 'GCD';

    const getVal = (key: string) => {
        const p = inputs[key];
        if (!p) return 0;
        const val = PayloadUtils.unwrap(p);
        const hydrated = PayloadUtils.hydrate(val, math);
        // Handle Units if necessary (for now, strip units or use scalar)
        if (p.meta?.unit && (typeof hydrated === 'number' || (hydrated && (hydrated as any).isBigNumber))) {
            try { return (hydrated as any).toNumber ? (hydrated as any).toNumber() : Number(hydrated); } catch (e) { return 0; }
        }
        return hydrated;
    };

    const valA = getVal('in_a');

    // For IsPrime, we only need A. For others, we need A and B.
    const valB = getVal('in_b');

    console.log('[NumberTheory] Execution:', { op, valA, valB, inputs });

    try {
        let result: any;
        switch (op) {
            case 'GCD': result = math.gcd(valA, valB); break;
            case 'LCM': result = math.lcm(valA, valB); break;
            case 'MOD': result = math.mod(valA, valB); break;
            case 'IS_PRIME': result = math.isPrime(valA); break;
            default: result = 0;
        }

        if (op === 'IS_PRIME') {
            return PayloadUtils.createBoolean(!!result);
        }

        // Convert BigNumber to number for display, similar into MA-01
        let finalValue = result;
        if (result && typeof result === 'object' && result.isBigNumber) {
            finalValue = result.toNumber();
        }

        const payload = {
            type: DataType.Scalar,
            value: PayloadUtils.dehydrate(finalValue),
            symbol: null,
            meta: {}
        };
        return payload;
    } catch (e: any) {
        return PayloadUtils.createError(`${op} Failed: ${e.message}`);
    }
}, (node, inputs) => {
    const op = node.data?.op || 'GCD';
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


// --- Logic Nodes ---

// MA-05: Logic Gates & Comparisons
NodeRegistry.register('MA-05', (node, inputs) => {
    const engine = MathEngine.getInstance();
    const math = engine.getMathInstance();
    const op = node.data?.op || 'AND';

    const getVal = (key: string) => {
        const p = inputs[key];
        if (!p) return null;
        // Hydrate to ensure we have comparable mathjs objects (BigNumber, Unit) or primitives
        const raw = PayloadUtils.unwrap(p);
        const hydrated = PayloadUtils.hydrate(raw, math);

        // MA-01 Style: Re-attach unit if available and not already a Unit object
        if (p.meta?.unit && (typeof hydrated === 'number' || (hydrated && (hydrated as any).isBigNumber))) {
            try { return math.unit(hydrated, p.meta.unit); } catch (e) { return hydrated; }
        }
        return hydrated;
    };

    const valA = getVal('in_a');
    const valB = getVal('in_b');

    // Bool conversion helper (loosely truthy)
    const toBool = (v: any) => PayloadUtils.toBoolean(v, math);

    try {
        let result: boolean;
        switch (op) {
            // Comparisons
            // Note: math.larger and friends work with Units, BigNumbers, etc.
            case 'GT': result = math.larger(valA, valB) as boolean; break;
            case 'LT': result = math.smaller(valA, valB) as boolean; break;
            case 'GTE': result = math.largerEq(valA, valB) as boolean; break;
            case 'LTE': result = math.smallerEq(valA, valB) as boolean; break;
            case 'NEQ': result = !math.equal(valA, valB) as boolean; break;
            case 'EQ': result = math.equal(valA, valB) as boolean; break;

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
        return PayloadUtils.createError(`${op} Failed: ${(e as any).message}`);
    }
}, (node, inputs) => {
    const op = node.data?.op || 'AND';
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
