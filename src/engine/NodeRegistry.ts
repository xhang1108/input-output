import { NodeLogic } from './types';
import { MathEngine } from './MathEngine';
import { NodePayload, DataType, ASTNode } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';
import { Brain } from './Brain';

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
            const sym = symbolizer(node, inputs);
            if (sym && !sym.sourceId && node.id) {
                sym.sourceId = node.id;
            }
            return sym;
        }

        // Default Symbolizer: Identifier vs Literal
        // Using "val" for default fallback logic.
        const data = (node.data || {}) as Record<string, unknown>;
        const label = data.label || node.id;
        let val: unknown = data.val;
        if (val === undefined && node.value) {
            val = PayloadUtils.unwrap(node.value);
        }

        if (val === undefined) {
            const sym = PayloadUtils.createSymbol('Identifier', { name: String(label), value: (typeof val === 'object' ? 'Complex' : val) as string | number | boolean | undefined });
            if (node.id) sym.sourceId = node.id;
            return sym;
        }
        if (typeof val === 'string' && val.trim() === '') {
            const sym = PayloadUtils.createSymbol('Literal', { value: (typeof val === 'object' ? 'Complex' : val) as string | number | boolean | undefined });
            if (node.id) sym.sourceId = node.id;
            return sym;
        }

        // Auto-detect if value is identifier (starts with letter) or literal number
        if (typeof val === 'string') {
            const isIdentifier = /^[a-zA-Z_]\w*$/.test(val);
            if (isIdentifier) {
                const sym = PayloadUtils.createSymbol('Identifier', { name: val, value: val as string | number | boolean | undefined });
                if (node.id) sym.sourceId = node.id;
                return sym;
            }
        }

        // We could theoretically use 'parseString' logic here too, but for symbolizer we keep it simple
        const name = String(label);
        const value = typeof val === 'object' ? 'Complex' : val;
        // If the node type expects an identifier name, we emit Identifier. 
        // For simple math nodes without special symbolizers, emitting literal is safer if it's a number.
        const sym = isNaN(Number(value))
            ? PayloadUtils.createSymbol('Identifier', { name, value: value as string | number | boolean | undefined })
            : PayloadUtils.createSymbol('Literal', { value: value as string | number | boolean | undefined });
        if (node.id) sym.sourceId = node.id;
        return sym;
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
    return PayloadUtils.createString(String(node.value || ''));
}, (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const sym = PayloadUtils.createSymbol('Literal', { value: String(data.value || '') });
    if (node.id) sym.sourceId = node.id;
    return sym;
});

// IO-11: Result (Display)
NodeRegistry.register('IO-11', (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createScalar(0);
}, (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createSymbol('Literal', { value: 0 });
});

// IO-08: Matrix Input
NodeRegistry.register('IO-08', (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const math = MathEngine.getInstance().getMathInstance();

    // 1. Try to use data.value first (live UI input)
    const dataVal = data.value;
    if (dataVal !== undefined) {
        console.log(`[NodeRegistry] IO-08 (${node.id}) using data.value:`, typeof dataVal, dataVal);
        // If it's already a payload, return it. If it's a matrix/array, wrap it.
        if (typeof dataVal === 'object' && dataVal !== null) {
            if ('type' in (dataVal as any) && 'value' in (dataVal as any)) return dataVal as NodePayload;

            // Check if it's a dehydrated MathJS object
            if ('mathjs' in (dataVal as any)) {
                return { type: DataType.Matrix, value: dataVal, symbol: null, meta: {} };
            }

            return PayloadUtils.createMatrix(dataVal);
        }
    }

    // 2. Parse from rawExpression if available (persistence)
    const raw = data.rawExpression as string;
    if (raw) {
        console.log(`[NodeRegistry] IO-08 (${node.id}) parsing rawExpression:`, raw);
        try {
            const parsed = JSON.parse(raw);
            return PayloadUtils.createMatrix(parsed);
        } catch (e) {
            return PayloadUtils.createMatrix([]);
        }
    }

    // 3. Last fallback: cached engine value
    if (node.value && typeof node.value === 'object' && ('type' in node.value)) {
        console.log(`[NodeRegistry] IO-08 (${node.id}) using cached node.value`);
        return node.value as NodePayload;
    }

    // 4. Default empty
    console.log(`[NodeRegistry] IO-08 (${node.id}) using fallback default`);
    return PayloadUtils.createMatrix([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
}, (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    // Matrix symbol is typically just the identifier if it has a label, or a generic Matrix literal
    const label = data.label as string;
    if (label) return PayloadUtils.createSymbol('Identifier', { name: label });

    // Fallback: literal representation or generic identifier
    return PayloadUtils.createSymbol('Identifier', { name: 'Matrix' });
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


// IO-21: Abacus
NodeRegistry.register('IO-21', (node) => {
    let total = 0;
    const digits = (node.data?.digits as number[]) || [0, 0, 0, 0, 0, 0, 0];

    // Digits[0] is highest, digits[last] is lowest for THIS specific abacus node.
    for (let i = 0; i < digits.length; i++) {
        total = total * 10 + digits[i];
    }

    return {
        type: DataType.Scalar,
        value: PayloadUtils.dehydrate(total),
        symbol: null,
        meta: {}
    };
}, (node) => {
    let total = 0;

    const accumulateValue = (currentNodeId: string): void => {
        const brainNodeMap = Brain.getInstance().getNodesMap();
        const currentNode = brainNodeMap.get(currentNodeId);
        const nodeData = (currentNode?.data || (currentNodeId === node.id ? node.data : {})) as Record<string, unknown>;

        if (nodeData.prevAbacusId) {
            accumulateValue(nodeData.prevAbacusId as string);
        }

        const digits = (nodeData.digits as number[]) || [0, 0, 0, 0, 0, 0, 0];

        for (let i = 0; i < digits.length; i++) {
            total = total * 10 + digits[i];
        }
    };

    accumulateValue(node.id);

    return PayloadUtils.createSymbol('Literal', { value: total });
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
    const data = (node.data || {}) as Record<string, unknown>;
    return PayloadUtils.createBoolean(!!PayloadUtils.unwrap(data.value));
}, (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    return PayloadUtils.createSymbol('Literal', { value: !!PayloadUtils.unwrap(data.value) });
});

// MA-09: Button
NodeRegistry.register('MA-09', (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    return PayloadUtils.createBoolean(!!PayloadUtils.unwrap(data.value));
}, (node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    return PayloadUtils.createSymbol('Literal', { value: !!PayloadUtils.unwrap(data.value) });
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

// --- Linear Algebra & Data Nodes ---

// AD-01: Matrix Tools
NodeRegistry.register('AD-01', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const valPayload = inputs['in'];
    if (!valPayload) return PayloadUtils.createError('No Input');

    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'INV';
    const val = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
    const m = math as unknown as Record<string, Function>;

    try {
        let result: unknown;
        if (op === 'INV') result = m.inv(val);
        else if (op === 'DET') result = m.det(val);
        else if (op === 'TRANSPOSE') result = m.transpose(val);
        else if (op === 'TRACE') result = m.trace(val);
        else if (op === 'EIGEN') result = m.eigs(val);
        else if (op === 'LUP') result = m.lup(val);
        else if (op === 'QR') result = m.qr(val);
        else result = val;

        if (op === 'QR' || op === 'LUP' || op === 'EIGEN') {
            const outMap: Record<string, string[]> = {
                'QR': ['Q', 'R'],
                'LUP': ['L', 'U', 'p'],
                'EIGEN': ['values', 'eigenvectors']
            };
            const keys = outMap[op];
            const multiValue: Record<string, unknown> = {};
            const handleMeta: Record<string, any> = {};

            for (const key of keys) {
                let subValue = (result as Record<string, unknown>)[key];

                // Map internal MathJS key 'p' to external handle 'P' for UI consistency
                const handleKey = key === 'p' ? 'P' : (key === 'eigenvectors' ? 'vectors' : key);

                // Special handling for eigenvectors: Convert Array<{value, vector}> to Matrix
                if (key === 'eigenvectors' && Array.isArray(subValue)) {
                    try {
                        const vectors = subValue.map(item => {
                            const v = item.vector;
                            return (v && typeof v === 'object' && 'toArray' in v) ? v.toArray() : v;
                        });
                        // Use math.transpose to make eigenvectors columns (standard convention)
                        subValue = math.transpose(vectors);
                    } catch (e) {
                        console.warn('[AD-01] Failed to format eigenvectors', e);
                    }
                }

                const matPayload = PayloadUtils.createMatrix(PayloadUtils.dehydrate(subValue) as any);
                matPayload.meta.unit = valPayload.meta?.unit;
                multiValue[handleKey] = matPayload;
                handleMeta[handleKey] = { unit: valPayload.meta?.unit };
            }
            return {
                type: DataType.Object,
                value: multiValue,
                symbol: null,
                meta: { handleMeta }
            };
        }

        return {
            type: Array.isArray(result) || (result && (result as any).isMatrix) ? DataType.Matrix : DataType.Scalar,
            value: PayloadUtils.dehydrate(result),
            symbol: null,
            meta: { unit: valPayload.meta?.unit }
        };
    } catch (e: unknown) {
        return PayloadUtils.createError(`${op} Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'INV';
    const funcMap: Record<string, string> = {
        INV: 'inv', DET: 'det', TRANSPOSE: 'transpose', TRACE: 'trace',
        EIGEN: 'eigs', LUP: 'lup', QR: 'qr'
    };
    return PayloadUtils.createSymbol('FunctionCall', {
        name: funcMap[op] || 'inv',
        args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 'Matrix' })]
    });
});

// AD-02: Vector Utils
NodeRegistry.register('AD-02', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'DOT';

    const getVal = (key: string) => {
        const p = inputs[key];
        if (!p) return null;
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(p), math);

        // AUTO-FLATTEN: Ensure input is a 1D array for vector utils
        if (hydrated && typeof hydrated === 'object' && (Array.isArray(hydrated) || 'isMatrix' in (hydrated as any))) {
            try {
                // flatten() returns a new matrix/array that is 1D
                const flattened = math.flatten(hydrated);
                return flattened;
            } catch (e) {
                return hydrated;
            }
        }
        return hydrated;
    };

    const valA = getVal('in_a');
    const valB = getVal('in_b');
    const m = math as unknown as Record<string, Function>;

    try {
        let result: unknown;
        if (op === 'DOT') result = m.dot(valA, valB);
        else if (op === 'CROSS') result = m.cross(valA, valB);
        else if (op === 'NORM') result = m.norm(valA);
        else if (op === 'DISTANCE') result = m.distance(valA, valB);
        else result = 0;

        return {
            type: Array.isArray(result) || (result && (result as any).isMatrix) ? DataType.Matrix : DataType.Scalar,
            value: PayloadUtils.dehydrate(result),
            symbol: null,
            meta: { unit: inputs['in_a']?.meta?.unit }
        };
    } catch (e: unknown) {
        return PayloadUtils.createError(`${op} Failed`);
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'DOT';
    const funcMap: Record<string, string> = {
        DOT: 'dot', CROSS: 'cross', NORM: 'norm', DISTANCE: 'distance'
    };

    const args = [inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 'a' })];
    if (op !== 'NORM') {
        args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 'b' }));
    }
    return PayloadUtils.createSymbol('FunctionCall', {
        name: funcMap[op] || 'dot',
        args: args
    });
});

// AD-03: Combinatorics
NodeRegistry.register('AD-03', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'nCr';

    const getVal = (key: string) => {
        const p = inputs[key];
        if (!p) return 0;
        let v = PayloadUtils.unwrap(p);

        // Ensure array scalar unpacking for combinatorics (like Vector length)
        if (Array.isArray(v) && v.length > 0) v = v[0];

        v = PayloadUtils.hydrate(v, math);
        // Force number
        if (typeof v === 'number') return v;
        if (v && typeof v === 'object' && 'toNumber' in v) return (v as any).toNumber();
        return Number(v) || 0;
    };

    const n = getVal('n');
    const r = getVal('r');
    const m = math as unknown as Record<string, Function>;

    try {
        let result: unknown;
        if (op === 'nCr') result = m.combinations(n, r);
        else if (op === 'nPr') result = m.permutations(n, r);
        else if (op === 'n!') result = m.factorial(n);
        else result = 0;

        return PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
    } catch (e: unknown) {
        return PayloadUtils.createError(`${op} Failed: ${e instanceof Error ? e.message : 'Invalid inputs'}`);
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'nCr';
    const funcMap: Record<string, string> = {
        'nCr': 'combinations', 'nPr': 'permutations', 'n!': 'factorial'
    };
    const args = [inputs['n'] || PayloadUtils.createSymbol('Literal', { value: 'n' })];
    if (op !== 'n!') {
        args.push(inputs['r'] || PayloadUtils.createSymbol('Literal', { value: 'r' }));
    }
    return PayloadUtils.createSymbol('FunctionCall', {
        name: funcMap[op] || 'combinations',
        args: args
    });
});
// AD-04: Derivative
NodeRegistry.register('AD-04', (node, inputs) => {
    const exprPayload = inputs['in_expr'];
    const varPayload = inputs['in_var'];

    if (!exprPayload) return PayloadUtils.createError('No Expression');

    try {
        const math = MathEngine.getInstance().getMathInstance();

        let exprStr = '';
        const exprVal = PayloadUtils.unwrap(exprPayload);
        if (typeof exprVal === 'string') exprStr = exprVal;
        else if (typeof exprVal === 'object' && exprVal !== null) exprStr = exprVal.toString();
        else exprStr = String(exprVal);

        let varStr = 'x';
        if (varPayload) {
            const v = PayloadUtils.unwrap(varPayload);
            if (typeof v === 'string' && v.trim() !== '') varStr = v.trim();
        }

        // Use mathjs symbolic derivative
        const derivative = math.derivative(exprStr, varStr);

        return PayloadUtils.createSymbolic(derivative.toString());
    } catch (e: unknown) {
        return PayloadUtils.createError(`Derivative Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}, (node, inputs) => {
    const varName = inputs['in_var'] ? PayloadUtils.unwrap(inputs['in_var']) : 'x';
    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'derivative',
        args: [
            inputs['in_expr'] || PayloadUtils.createSymbol('Literal', { value: '0' }),
            PayloadUtils.createSymbol('Literal', { value: String(varName) })
        ]
    });
});

// AD-05: Integral
NodeRegistry.register('AD-05', (node, inputs) => {
    const exprPayload = inputs['in_expr'];
    const varPayload = inputs['in_var'];

    if (!exprPayload) return PayloadUtils.createError('No Expression');

    try {
        const nerdamer = require('nerdamer/all');

        let exprStr = '';
        const exprVal = PayloadUtils.unwrap(exprPayload);
        if (typeof exprVal === 'string') exprStr = exprVal;
        else if (typeof exprVal === 'object' && exprVal !== null) exprStr = exprVal.toString();
        else exprStr = String(exprVal);

        let varStr = 'x';
        if (varPayload) {
            const v = PayloadUtils.unwrap(varPayload);
            if (typeof v === 'string' && v.trim() !== '') varStr = v.trim();
        }

        // Use nerdamer for integration: integrate(f(x), x)
        const integration = nerdamer(`integrate(${exprStr}, ${varStr})`);

        // Return nicely formatted string
        return PayloadUtils.createSymbolic(integration.text('decimals'));
    } catch (e: unknown) {
        return PayloadUtils.createError(`Integration Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}, (node, inputs) => {
    const varName = inputs['in_var'] ? PayloadUtils.unwrap(inputs['in_var']) : 'x';
    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'integrate',
        args: [
            inputs['in_expr'] || PayloadUtils.createSymbol('Literal', { value: '0' }),
            PayloadUtils.createSymbol('Literal', { value: String(varName) })
        ]
    });
});

// AD-06: Solver
NodeRegistry.register('AD-06', (node, inputs) => {
    // Collect all inputs. With capsule handles, Brain passes `in` as an array
    // if there are multiple connections, but we should also handle dynamic `in_X` if they exist.
    const equations: string[] = [];

    const inPayload = inputs['in'];
    if (inPayload) {
        // We use a robust recursive flatter, similar to ArrayBuilder COMBINE mode
        const processPayload = (p: any) => {
            const val = PayloadUtils.unwrap(p);
            // Re-hydrate in case it's a serialized matrix
            // Use MathEngine if we need mathjs hydration, but here we just want strings
            // so we don't strictly need MathEngine, but we check for toArray just in case.
            if (val && typeof val === 'object' && 'toArray' in (val as any)) {
                (val as any).toArray().flat(Infinity).forEach((v: any) => {
                    if (typeof v === 'string') equations.push(v);
                    else if (v !== null && v !== undefined) equations.push(String(v));
                });
            } else if (Array.isArray(val)) {
                val.flat(Infinity).forEach(v => {
                    if (typeof v === 'object' && v !== null && 'value' in v) {
                        const innerVal = (v as any).value;
                        if (typeof innerVal === 'string') equations.push(innerVal);
                        else if (innerVal !== null && innerVal !== undefined) equations.push(String(innerVal));
                    } else if (typeof v === 'string') {
                        equations.push(v);
                    } else if (v !== null && v !== undefined) {
                        equations.push(String(v));
                    }
                });
            } else if (typeof val === 'string') {
                equations.push(val);
            } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                // Check if it's our bundle object
                if ('value' in val) {
                    processPayload({ value: val.value }); // Recurse
                } else {
                    Object.values(val).forEach(v => {
                        if (typeof v === 'string') equations.push(v);
                        else if (v !== null && v !== undefined) equations.push(String(v));
                    });
                }
            } else if (val !== null && val !== undefined) {
                equations.push(String(val));
            }
        };

        if (Array.isArray(inPayload)) {
            inPayload.forEach(processPayload);
        } else {
            processPayload(inPayload);
        }
    }

    // Also check for dynamic inputs like in_1, in_2... just in case
    for (const [key, payload] of Object.entries(inputs)) {
        if (key !== 'in' && key.startsWith('in')) {
            const val = PayloadUtils.unwrap(payload);
            if (typeof val === 'string') equations.push(val);
        }
    }

    if (equations.length === 0) {
        return PayloadUtils.createError('No Equation Input');
    }

    try {
        // Dynamic require since we don't want to break the whole bundle if nerdamer fails
        const nerdamer = require('nerdamer/all');

        const solveFor = (node.data?.solveFor as string | undefined) || '';

        let solutions;
        if (equations.length === 1) {
            // Single equation
            if (solveFor.trim() !== '') {
                solutions = nerdamer(equations[0]).solveFor(solveFor.trim());
            } else {
                solutions = nerdamer.solveEquations(equations[0]);
            }
        } else {
            // Multiple equations
            solutions = nerdamer.solveEquations(equations);
            if (solveFor.trim() !== '' && Array.isArray(solutions)) {
                // Return only the solution for the targeted variable
                const targetSol = solutions.find(s => Array.isArray(s) && s[0] === solveFor.trim());
                if (targetSol && targetSol.length > 1) {
                    // Extract just the value to make it behave like a single-variable solve
                    solutions = [targetSol[1]];
                }
            }
        }

        // Format the output
        let outStr = '';
        if (Array.isArray(solutions)) {
            // For multiple equations, nerdamer typically returns an array of arrays like: [["x",1],["y",2]]
            // For single equation, it returns an array of roots, which are Nerdamer Expression objects.
            // We must convert them to clean text so they don't get serialized as AST Objects or raw strings.
            // Using nerdamer(s).text() provides a cleaner, more standard math string (e.g. 1/2 instead of 1*2^(-1))
            const mappedValues = solutions.map(s => {
                try {
                    if (Array.isArray(s)) {
                        return `[${s.map(ss => {
                            try { return nerdamer(ss).text('decimals'); }
                            catch { return ss.toString(); }
                        }).join(', ')}]`;
                    }
                    return nerdamer(s).text('decimals'); // 'decimals' forces fractions where reasonable
                } catch (e) {
                    return s.toString();
                }
            });

            if (equations.length > 1) {
                // System of equations output, typically looks like [[x, 3], [y, 2]]
                outStr = `[${mappedValues.join(', ')}]`;
            } else {
                // Single equation output, typically looks like [5] or [2, 3]
                if (mappedValues.length === 1) {
                    // Just output the single root, e.g. "5" instead of "[5]" -- or keep it in brackets to be consistent?
                    // Let's keep it in brackets if it's multiple roots, or just output the number if it's 1 root.
                    outStr = `[${mappedValues[0]}]`;
                } else {
                    outStr = `[${mappedValues.join(', ')}]`;
                }
            }
        } else if (typeof solutions === 'object' && solutions !== null) {
            // Sometimes it might return an object
            try {
                if ('toString' in solutions) outStr = solutions.toString();
                else outStr = JSON.stringify(solutions).replace(/"/g, '');
            } catch (e) {
                outStr = String(solutions);
            }
        } else {
            outStr = String(solutions);
        }

        return PayloadUtils.createSymbolic(outStr);
    } catch (e: unknown) {
        return PayloadUtils.createError(`Solve Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}, (node, inputs) => {
    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'solve',
        args: [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: '0' })]
    });
});

// AD-07: Complex Math
NodeRegistry.register('AD-07', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'separate';

    try {
        if (mode === 'separate') {
            const valPayload = inputs['in'];
            if (!valPayload) return PayloadUtils.createError('No Input');
            const val = PayloadUtils.hydrate(valPayload.value, math);

            // Re, Im, Abs(r), Arg(phi)
            const re = math.re(val);
            const im = math.im(val);
            const abs = math.abs(val);
            // mathjs arg() handles scalar and complex correctly. If positive scalar: 0. If negative: pi.
            const arg = typeof math.arg === 'function' ? math.arg(val) : 0;

            const multiValue: Record<string, unknown> = {
                're': PayloadUtils.createScalar(PayloadUtils.dehydrate(re)),
                'im': PayloadUtils.createScalar(PayloadUtils.dehydrate(im)),
                'abs': PayloadUtils.createScalar(PayloadUtils.dehydrate(abs)),
                'arg': PayloadUtils.createScalar(PayloadUtils.dehydrate(arg))
            };

            return {
                type: DataType.Object,
                value: multiValue,
                symbol: null,
                meta: { unit: valPayload.meta?.unit }
            };
        } else if (mode === 'combine_cartesian') {
            const re = PayloadUtils.hydrate(inputs['in_re']?.value || 0, math);
            const im = PayloadUtils.hydrate(inputs['in_im']?.value || 0, math);

            const result = math.complex(Number(re), Number(im));
            return PayloadUtils.createScalar(PayloadUtils.dehydrate(result));

        } else if (mode === 'combine_polar') {
            const r = PayloadUtils.hydrate(inputs['in_abs']?.value || 0, math);
            const phi = PayloadUtils.hydrate(inputs['in_arg']?.value || 0, math);

            const result = math.complex({ r: Number(r), phi: Number(phi) });
            return PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
        }

        return PayloadUtils.createError('Invalid Mode');
    } catch (e: unknown) {
        return PayloadUtils.createError(`Complex Math Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'separate';

    if (mode === 'separate') {
        const inSym = inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 'z' });
        // Since Multi-outputs can't pass specific symbols downstream yet, we return a general function call
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'complex_parts',
            args: [inSym]
        });
    } else if (mode === 'combine_cartesian') {
        const reSym = inputs['in_re'] || PayloadUtils.createSymbol('Literal', { value: 0 });
        const imSym = inputs['in_im'] || PayloadUtils.createSymbol('Literal', { value: 0 });
        const iSym = PayloadUtils.createSymbol('Identifier', { name: 'i' });
        const imParts = PayloadUtils.createSymbol('BinaryExpression', { operator: '*', left: imSym, right: iSym });
        return PayloadUtils.createSymbol('BinaryExpression', { operator: '+', left: reSym, right: imParts });
    } else if (mode === 'combine_polar') {
        const rSym = inputs['in_abs'] || PayloadUtils.createSymbol('Literal', { value: 0 });
        const phiSym = inputs['in_arg'] || PayloadUtils.createSymbol('Literal', { value: 0 });
        const eSym = PayloadUtils.createSymbol('Identifier', { name: 'e' });
        const iSym = PayloadUtils.createSymbol('Identifier', { name: 'i' });
        const iphi = PayloadUtils.createSymbol('BinaryExpression', { operator: '*', left: iSym, right: phiSym });
        const expPart = PayloadUtils.createSymbol('BinaryExpression', { operator: '^', left: eSym, right: iphi });
        return PayloadUtils.createSymbol('BinaryExpression', { operator: '*', left: rSym, right: expPart });
    }
    return PayloadUtils.createSymbol('Identifier', { name: 'Complex' });
});

// AD-08: Vector Field
NodeRegistry.register('AD-08', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;

    const mode = data.mode as string || 'gradient';
    const var1 = data.var1 as string || 'x';
    const var2 = data.var2 as string || 'y';
    const min = data.min !== undefined ? Number(data.min) : -5;
    const max = data.max !== undefined ? Number(data.max) : 5;
    const density = data.density !== undefined ? Number(data.density) : 10;

    const inPayload = inputs['in_f'];
    if (!inPayload) return PayloadUtils.createError('No input function/vector provided');

    try {
        // Prepare the function(s) to evaluate
        const exprVal = PayloadUtils.unwrap(inPayload);
        if (!exprVal) return PayloadUtils.createError('Invalid input function');

        let uExpr: any;
        let vExpr: any;
        let outGradSymbols: Record<string, unknown> | null = null;
        let unitMeta = inPayload.meta?.unit;

        if (mode === 'gradient') {
            // exprVal should be a scalar expression (string or parsed node)
            const nodeExpr = typeof exprVal === 'string' ? math.parse(exprVal) : exprVal;
            if (typeof nodeExpr !== 'object' || !nodeExpr || !('isNode' in nodeExpr)) {
                return PayloadUtils.createError('Input must be a valid expression for gradient');
            }

            // Symbolic derivatives
            uExpr = math.derivative(nodeExpr as any, var1);
            vExpr = math.derivative(nodeExpr as any, var2);

            // Format symbolic output for out_grad
            outGradSymbols = {
                type: DataType.Vector,
                value: [uExpr.toString(), vExpr.toString()],
                symbol: null,
                meta: {}
            };
        } else {
            // Direct mode: exprVal should be a vector of length 2
            const hydrated = PayloadUtils.hydrate(exprVal, math);
            let arr: any[] = [];
            if (hydrated && typeof hydrated === 'object' && hydrated !== null && 'toArray' in (hydrated as any)) {
                arr = (hydrated as any).toArray().flat(Infinity);
            } else if (Array.isArray(hydrated)) {
                arr = hydrated.flat(Infinity);
            }

            if (arr.length < 2) {
                return PayloadUtils.createError('Input must be a 2D vector [u, v]');
            }

            // Parse array elements into executable nodes
            uExpr = typeof arr[0] === 'string' ? math.parse(arr[0]) : (typeof arr[0] === 'object' && 'isNode' in arr[0] ? arr[0] : math.parse(String(arr[0])));
            vExpr = typeof arr[1] === 'string' ? math.parse(arr[1]) : (typeof arr[1] === 'object' && 'isNode' in arr[1] ? arr[1] : math.parse(String(arr[1])));
        }

        // Compile for fast execution over grid
        const uCode = uExpr.compile();
        const vCode = vExpr.compile();

        // Generate grid
        const step = (max - min) / Math.max(1, density - 1);
        const fieldData: number[][] = [];

        // Loop over Y outer, X inner (or vice versa doesn't strictly matter for flat array)
        for (let i = 0; i < density; i++) {
            const y = min + i * step;
            for (let j = 0; j < density; j++) {
                const x = min + j * step;

                const scope = { [var1]: x, [var2]: y };
                try {
                    const vx = Number(uCode.evaluate(scope)) || 0;
                    const vy = Number(vCode.evaluate(scope)) || 0;

                    // Format required for plotting: [x, y, vx, vy]
                    fieldData.push([x, y, vx, vy]);
                } catch {
                    // Ignore errors at specific points (e.g. division by zero)
                    fieldData.push([x, y, 0, 0]);
                }
            }
        }

        const multiValue: Record<string, unknown> = {
            'out_field': {
                type: DataType.Matrix,
                value: fieldData,
                symbol: null,
                meta: { unit: unitMeta } // Propagate base unit, might need dividing by domain unit later
            }
        };

        if (outGradSymbols) {
            multiValue['out_grad'] = outGradSymbols;
        }

        return {
            type: DataType.Object,
            value: multiValue,
            symbol: null,
            meta: {}
        };

    } catch (e: unknown) {
        return PayloadUtils.createError(`Vector Field Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'gradient';
    const inSym = inputs['in_f'] || PayloadUtils.createSymbol('Literal', { value: 'f' });

    if (mode === 'gradient') {
        const nabla = PayloadUtils.createSymbol('Identifier', { name: '\\nabla' });
        return PayloadUtils.createSymbol('FunctionCall', {
            name: '',
            args: [nabla, inSym]
        });
    } else {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'VectorField',
            args: [inSym]
        });
    }
});

// AD-09: Vector Split 
NodeRegistry.register('AD-09', (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'separate'; // 'separate' | 'combine'

    const math = MathEngine.getInstance().getMathInstance();

    if (mode === 'separate') {
        const valPayload = inputs['in'] || Object.values(inputs)[0];
        if (!valPayload) return PayloadUtils.createError('No Input');

        const raw = PayloadUtils.unwrap(valPayload);
        const hydrated = PayloadUtils.hydrate(raw, math);

        let arr: any[] = [];
        try {
            if (hydrated && typeof hydrated === 'object' && hydrated !== null && 'toArray' in (hydrated as any)) {
                arr = (hydrated as any).toArray().flat(Infinity);
            } else if (Array.isArray(hydrated)) {
                arr = hydrated.flat(Infinity);
            } else if (hydrated !== undefined && hydrated !== null) {
                arr = [hydrated];
            }
        } catch (e) {
            return PayloadUtils.createError('Split Failed: Invalid Matrix');
        }

        // Standard Vector Split always maps to X, Y, Z (first 3 elements)
        return {
            type: DataType.Object,
            value: {
                x: PayloadUtils.wrap(arr[0] ?? 0),
                y: PayloadUtils.wrap(arr[1] ?? 0),
                z: PayloadUtils.wrap(arr[2] ?? 0)
            },
            symbol: null,
            meta: {
                handleMeta: {
                    x: { unit: valPayload.meta?.unit },
                    y: { unit: valPayload.meta?.unit },
                    z: { unit: valPayload.meta?.unit }
                }
            }
        };
    } else {
        // COMBINE Mode
        let items: any[] = [];

        // Use 'in' (Capsule Handle)
        const inPayload = inputs['in'];
        if (inPayload) {
            const processPayload = (p: any) => {
                const val = PayloadUtils.unwrap(p);
                const hydrated = PayloadUtils.hydrate(val, math);

                // If the incoming payload is itself an array/matrix, flatten its values into our items list
                if (hydrated && typeof hydrated === 'object' && 'toArray' in (hydrated as any)) {
                    items.push(...(hydrated as any).toArray().flat(Infinity));
                } else if (Array.isArray(hydrated)) {
                    items.push(...hydrated.flat(Infinity));
                } else {
                    items.push(hydrated);
                }
            };

            if (Array.isArray(inPayload)) {
                inPayload.forEach(processPayload);
            } else {
                processPayload(inPayload);
            }
        } else {
            // Fallback for old explicit 'x', 'y', 'z' handles
            const x = PayloadUtils.hydrate(PayloadUtils.unwrap(inputs['x']), math) || 0;
            const y = PayloadUtils.hydrate(PayloadUtils.unwrap(inputs['y']), math) || 0;
            const z = PayloadUtils.hydrate(PayloadUtils.unwrap(inputs['z']), math) || 0;
            items = [x, y, z];
        }

        const unit = items.length > 0 ? (Array.isArray(inputs['in']) ? inputs['in'][0]?.meta?.unit : (inputs['in'] as any)?.meta?.unit) : undefined;

        try {
            const mat = items.length > 0 ? math.matrix(items) : math.matrix([0, 0, 0]);
            return {
                type: DataType.Matrix,
                value: PayloadUtils.dehydrate(mat),
                symbol: null,
                meta: { unit }
            };
        } catch (e) {
            return PayloadUtils.createError('Combine Failed');
        }
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'separate'; // 'separate' | 'combine'

    if (mode === 'separate') {
        return PayloadUtils.createSymbol('Identifier', { name: 'SplitVector' });
    } else {
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'matrix',
            args: Array.isArray(inputs['in'])
                ? inputs['in']
                : [inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 })]
        });
    }
});

// AD-10: Geometry
NodeRegistry.register('AD-10', (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const shape = data.shape as string || 'Circle';
    const math = MathEngine.getInstance().getMathInstance();

    let area = 0;
    let perimeter = 0;
    let volume = 0;

    const getNum = (key: string) => {
        const p = inputs[key];
        if (!p) return 0;
        const val = PayloadUtils.unwrap(p);
        const hydrated = PayloadUtils.hydrate(val, math);
        if (typeof hydrated === 'number') return hydrated;
        if (hydrated && typeof hydrated === 'object' && 'toNumber' in (hydrated as any)) {
            try { return (hydrated as any).toNumber(); } catch { return 0; }
        }
        return Number(hydrated) || 0;
    };

    if (shape === 'Circle') {
        const r = getNum('in_a');
        area = Math.PI * r * r;
        perimeter = 2 * Math.PI * r;
    } else if (shape === 'Quad') {
        const w = getNum('in_a');
        const h = getNum('in_b');
        area = w * h;
        perimeter = 2 * (w + h);
    } else if (shape === 'Triangle') {
        const b = getNum('in_a');
        const h = getNum('in_b');
        area = 0.5 * b * h;
        // Simple perimeter approximation for right triangle if user only provides base/height
        perimeter = b + h + Math.sqrt(b * b + h * h);
    }

    return {
        type: DataType.Object,
        value: {
            // Re-use wrap safely
            area: PayloadUtils.wrap(area),
            perimeter: PayloadUtils.wrap(perimeter),
            volume: PayloadUtils.wrap(volume)
        },
        symbol: null,
        meta: {}
    };
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const shape = data.shape as string || 'Circle';

    // Simplistic Function call for formula display
    const args = [];
    if (shape === 'Circle') {
        args.push(inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }));
    } else {
        args.push(inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }));
        args.push(inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 }));
    }

    return PayloadUtils.createSymbol('FunctionCall', {
        name: `${shape.toLowerCase()}`,
        args: args
    });
});

// DA-06: Array Extract
NodeRegistry.register('DA-06', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const valPayload = inputs['in'];
    const idxPayload = inputs['index'];

    if (!valPayload || !idxPayload) return PayloadUtils.createError('Missing Inputs');

    let arr = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
    let idx = PayloadUtils.hydrate(PayloadUtils.unwrap(idxPayload), math);

    const m = math as unknown as Record<string, Function>;
    try {
        let i = typeof idx === 'number' ? idx : (idx && typeof idx === 'object' && 'toNumber' in (idx as any)) ? (idx as any).toNumber() : 0;

        let result: unknown;
        if (arr && typeof arr === 'object' && 'get' in (arr as any)) {
            // MathJS Matrix robust access
            // Subtract 1 if user expects 1-based indexing? No, MathJS is 0-based by default in subset, 
            // but we use subset with index() which is usually 0-based.
            // Let's stick to 0-based for now.
            try {
                // If 1D, use single index. If 2D, we might need [row, col].
                // For Array Extract, we usually assume a flat list or the first dimension.
                const size = (arr as any).size();
                if (size.length === 1) {
                    result = (arr as any).get([Math.floor(i)]);
                } else {
                    // Fallback to subset for multidimensional
                    const indexObj = m.index(Math.floor(i));
                    result = m.subset(arr, indexObj);
                }
            } catch (e) {
                // Fallback to simple array access if it's not a MathJS matrix or fails
                const flat = (arr as any).toArray ? (arr as any).toArray() : arr;
                result = Array.isArray(flat) ? flat[Math.floor(i)] : flat;
            }
        } else if (Array.isArray(arr)) {
            result = arr[Math.floor(i)];
        } else {
            result = arr; // scalar fallback
        }

        return {
            type: Array.isArray(result) || (result && (result as any).isMatrix) ? DataType.Matrix : DataType.Scalar,
            value: PayloadUtils.dehydrate(result),
            symbol: null,
            meta: { unit: valPayload.meta?.unit }
        };
    } catch (e: unknown) {
        return PayloadUtils.createError('Extract Failed (Out of Bounds?)');
    }
}, (node, inputs) => {
    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'subset',
        args: [
            inputs['in'] || PayloadUtils.createSymbol('Literal', { value: '[]' }),
            inputs['index'] || PayloadUtils.createSymbol('Literal', { value: 0 })
        ]
    });
});

// DA-07: Array Builder
NodeRegistry.register('DA-07', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;
    const axis = data.axis as number || 0;

    let items: any[] = [];

    // Support for Capsule Handle (multi inputs on 'in')
    if (inputs['in']) {
        const val = inputs['in'];
        if (Array.isArray(val)) {
            items = val.map(p => PayloadUtils.hydrate(PayloadUtils.unwrap(p), math));
        } else {
            items = [PayloadUtils.hydrate(PayloadUtils.unwrap(val), math)];
        }
    } else {
        // Fallback for older projects (in_0, in_1)
        const inputKeys = Object.keys(inputs).filter(k => k.startsWith('in_')).sort((a, b) => {
            return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
        });
        items = inputKeys.map(k => PayloadUtils.hydrate(PayloadUtils.unwrap(inputs[k]), math));
    }

    if (items.length === 0) return PayloadUtils.createMatrix([]);

    const m = math as unknown as Record<string, Function>;

    try {
        if (items.length === 1) {
            return {
                type: Array.isArray(items[0]) || (items[0] && (items[0] as any).isMatrix) ? DataType.Matrix : DataType.Scalar,
                value: PayloadUtils.dehydrate(items[0]),
                symbol: null,
                meta: {}
            };
        }

        let result: unknown;
        try {
            result = m.concat(...items, axis);
        } catch (e) {
            // Fallback for purely 1D arrays if concat fails dimensions
            result = m.matrix(items);
        }

        return {
            type: DataType.Matrix,
            value: PayloadUtils.dehydrate(result),
            symbol: null,
            meta: {}
        };
    } catch (e: unknown) {
        return PayloadUtils.createMatrix(PayloadUtils.dehydrate(items));
    }
}, (node, inputs) => {
    let argList: any[] = [];

    if (inputs['in']) {
        const val = inputs['in'];
        if (Array.isArray(val)) {
            argList = [...val];
        } else {
            argList = [val];
        }
    } else {
        argList = Object.keys(inputs).filter(k => k.startsWith('in_')).sort((a, b) => {
            return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
        }).map(k => inputs[k]);
    }

    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'concat',
        args: argList.length ? argList : [PayloadUtils.createSymbol('Literal', { value: '[]' })]
    });
});

// DA-01: Statistics
NodeRegistry.register('DA-01', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'Mean';
    const valPayload = inputs['data'];
    if (!valPayload) return PayloadUtils.createError('No Input');

    const raw = PayloadUtils.unwrap(valPayload);
    const hydrated = PayloadUtils.hydrate(raw, math);

    let arr: any[] = [];
    if (hydrated && typeof hydrated === 'object' && hydrated !== null && 'toArray' in (hydrated as any)) {
        arr = (hydrated as any).toArray().flat(Infinity);
    } else if (Array.isArray(hydrated)) {
        arr = hydrated.flat(Infinity);
    } else {
        arr = [hydrated];
    }

    if (arr.length === 0) return PayloadUtils.createError('Empty Array');

    try {
        const m = math as unknown as Record<string, Function>;
        let result: unknown = 0;
        switch (op) {
            case 'Mean': result = m.mean(arr); break;
            case 'Max': result = m.max(arr); break;
            case 'Min': result = m.min(arr); break;
            case 'StdDev': result = m.std(arr); break;
            case 'Median': result = m.median(arr); break;
            case 'Variance': result = m.variance(arr); break;
            case 'Sum': result = m.sum(arr); break;
            default: result = m.mean(arr);
        }
        return PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
    } catch (e: unknown) {
        return PayloadUtils.createError(`Stats Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const op = data.op as string || 'Mean';
    const opMap: Record<string, string> = {
        'Mean': 'mean', 'Max': 'max', 'Min': 'min', 'StdDev': 'std',
        'Median': 'median', 'Variance': 'variance', 'Sum': 'sum'
    };
    return PayloadUtils.createSymbol('FunctionCall', {
        name: opMap[op] || 'mean',
        args: [inputs['data'] || PayloadUtils.createSymbol('Literal', { value: '[]' })]
    });
});

// DA-05: Distributions
NodeRegistry.register('DA-05', (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'Normal';

    const getN = () => {
        if (inputs['param_n']) return Number(PayloadUtils.unwrap(inputs['param_n'])) || 100;
        return data.n !== undefined ? Number(data.n) : 100;
    };

    const getP1 = () => {
        if (inputs['param_1']) return Number(PayloadUtils.unwrap(inputs['param_1']));
        return data.p1 !== undefined ? Number(data.p1) : (mode === 'Normal' ? 0 : 1);
    };

    const getP2 = () => {
        if (inputs['param_2']) return Number(PayloadUtils.unwrap(inputs['param_2']));
        return data.p2 !== undefined ? Number(data.p2) : (mode === 'Uniform' ? 10 : 1);
    };

    const n = Math.max(1, Math.min(100000, Math.floor(getN()))); // Limit safe bound
    const p1 = getP1();
    const p2 = getP2();
    const samples: number[] = new Array(n);

    try {
        if (mode === 'Normal') {
            // Box-Muller transform
            for (let i = 0; i < n; i++) {
                let u = 0, v = 0;
                while (u === 0) u = Math.random();
                while (v === 0) v = Math.random();
                const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
                samples[i] = z * p2 + p1; // z * sigma + mu
            }
        } else if (mode === 'Uniform') {
            const min = Math.min(p1, p2);
            const max = Math.max(p1, p2);
            for (let i = 0; i < n; i++) {
                samples[i] = min + Math.random() * (max - min);
            }
        } else if (mode === 'Poisson') {
            // Knuth algorithm (simple version, ok for small lambda)
            const L = Math.exp(-p1);
            for (let i = 0; i < n; i++) {
                let p = 1.0;
                let k = 0;
                do {
                    k++;
                    p *= Math.random();
                } while (p > L);
                samples[i] = k - 1;
            }
        }

        return PayloadUtils.createMatrix(PayloadUtils.dehydrate(samples));
    } catch (e: unknown) {
        return PayloadUtils.createError('Distribution Generation Failed');
    }
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'Normal';
    return PayloadUtils.createSymbol('FunctionCall', {
        name: `random_${mode.toLowerCase()}`,
        args: [
            inputs['param_n'] || PayloadUtils.createSymbol('Literal', { value: data.n as number }),
            inputs['param_1'] || PayloadUtils.createSymbol('Literal', { value: data.p1 as number }),
            inputs['param_2'] || PayloadUtils.createSymbol('Literal', { value: data.p2 as number })
        ].filter(v => v !== undefined)
    });
});

// DA-02: SmoothingNode
NodeRegistry.register('DA-02', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;

    let windowSize = 3;
    if (inputs['window']) {
        windowSize = Number(PayloadUtils.unwrap(inputs['window'])) || 3;
    } else {
        windowSize = data.windowMode !== undefined ? Number(data.windowMode) : 3;
    }

    const valPayload = inputs['data'];
    if (!valPayload) return PayloadUtils.createError('No Input');

    const raw = PayloadUtils.unwrap(valPayload);
    const hydrated = PayloadUtils.hydrate(raw, math);

    let arr: any[] = [];
    if (hydrated && typeof hydrated === 'object' && hydrated !== null && 'toArray' in (hydrated as any)) {
        arr = (hydrated as any).toArray().flat(Infinity);
    } else if (Array.isArray(hydrated)) {
        arr = hydrated.flat(Infinity);
    } else {
        arr = [hydrated];
    }

    if (arr.length === 0) return PayloadUtils.createMatrix([]);
    windowSize = Math.max(1, Math.min(arr.length, Math.floor(windowSize)));

    const result = [];
    for (let i = 0; i < arr.length; i++) {
        let sum = 0;
        let count = 0;
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(arr.length - 1, i + Math.floor(windowSize / 2));
        for (let j = start; j <= end; j++) {
            sum += Number(arr[j]) || 0;
            count++;
        }
        result.push(sum / count);
    }

    return PayloadUtils.createMatrix(PayloadUtils.dehydrate(result));
}, (node, inputs) => {
    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'smooth',
        args: [
            inputs['data'] || PayloadUtils.createSymbol('Literal', { value: '[]' }),
            inputs['window'] || PayloadUtils.createSymbol('Literal', { value: (node.data?.windowMode || 3) as number })
        ]
    });
});

// DA-03: ListUtilityNode
NodeRegistry.register('DA-03', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'Sort (Asc)';

    const valPayload = inputs['data'];
    if (!valPayload) return PayloadUtils.createError('No Input');

    const raw = PayloadUtils.unwrap(valPayload);
    const hydrated = PayloadUtils.hydrate(raw, math);

    let arr: any[] = [];
    if (hydrated && typeof hydrated === 'object' && hydrated !== null && 'toArray' in (hydrated as any)) {
        arr = (hydrated as any).toArray().flat(Infinity);
    } else if (Array.isArray(hydrated)) {
        arr = hydrated.flat(Infinity);
    } else {
        arr = [hydrated];
    }

    if (arr.length === 0) return PayloadUtils.createMatrix([]);

    let result = [...arr];

    if (mode === 'Sort (Asc)') {
        result.sort((a, b) => Number(a) - Number(b));
    } else if (mode === 'Sort (Desc)') {
        result.sort((a, b) => Number(b) - Number(a));
    } else if (mode === 'Reverse') {
        result.reverse();
    } else if (mode === 'Unique') {
        result = [...new Set(result.map(x => String(x)))].map(x => Number(x));
    } else if (mode === 'Clean') {
        result = result.filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));
    }

    return PayloadUtils.createMatrix(PayloadUtils.dehydrate(result));
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'Sort (Asc)';
    let funcName = 'listUtil';
    if (mode.startsWith('Sort')) funcName = 'sort';
    else if (mode === 'Reverse') funcName = 'reverse';
    else if (mode === 'Unique') funcName = 'unique';
    else if (mode === 'Clean') funcName = 'clean';

    return PayloadUtils.createSymbol('FunctionCall', {
        name: funcName,
        args: [
            inputs['data'] || PayloadUtils.createSymbol('Literal', { value: '[]' })
        ]
    });
});

// DA-04: SetOpsNode
NodeRegistry.register('DA-04', (node, inputs) => {
    const math = MathEngine.getInstance().getMathInstance();
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'Union';

    const getArr = (key: string) => {
        const valPayload = inputs[key];
        if (!valPayload) return [];
        const raw = PayloadUtils.unwrap(valPayload);
        const hydrated = PayloadUtils.hydrate(raw, math);
        if (hydrated && typeof hydrated === 'object' && hydrated !== null && 'toArray' in (hydrated as any)) {
            return (hydrated as any).toArray().flat(Infinity);
        } else if (Array.isArray(hydrated)) {
            return hydrated.flat(Infinity);
        } else {
            return [hydrated];
        }
    };

    const arrA = getArr('a');
    const arrB = getArr('b');

    const setA: string[] = Array.from(new Set(arrA.map((x: any) => String(x))));
    const setB: string[] = Array.from(new Set(arrB.map((x: any) => String(x))));

    let resultSet: string[] = [];

    if (mode === 'Union') {
        resultSet = Array.from(new Set([...setA, ...setB]));
    } else if (mode === 'Intersection') {
        const bLookup = new Set<string>(setB);
        resultSet = setA.filter((x: string) => bLookup.has(x));
    } else if (mode === 'Difference') {
        const bLookup = new Set<string>(setB);
        resultSet = setA.filter((x: string) => !bLookup.has(x));
    }

    const finalResult = resultSet.map((x: string) => {
        const n = Number(x);
        return Number.isNaN(n) ? x : n;
    });

    return PayloadUtils.createMatrix(PayloadUtils.dehydrate(finalResult));
}, (node, inputs) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const mode = data.mode as string || 'Union';

    return PayloadUtils.createSymbol('FunctionCall', {
        name: mode.toLowerCase(),
        args: [
            inputs['a'] || PayloadUtils.createSymbol('Literal', { value: '[]' }),
            inputs['b'] || PayloadUtils.createSymbol('Literal', { value: '[]' })
        ]
    });
});
