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

type NodeEvaluator = (node: NodeLogic, inputs: Record<string, NodePayload>) => NodePayload;
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

    public static evaluate(node: NodeLogic, inputs: Record<string, NodePayload>): NodePayload {
        // Mute Bypass Logic: If muted, pass through the primary input
        if (node.data?.muted) {
            const primaryInput = inputs['in'] || inputs['in_a'] || Object.values(inputs)[0];
            if (primaryInput) return primaryInput;
            return node.value || PayloadUtils.createScalar(0);
        }

        const evaluator = this.evaluators.get(node.type || 'baseNode');
        const result = evaluator ? evaluator(node, inputs) : node.value;

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

// IO-11: Result (Display)
NodeRegistry.register('IO-11', (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createScalar(0);
}, (node, inputs) => {
    return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createSymbol('Literal', { value: 0 });
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

    let procA = valA, procB = valB;
    if (op === 'ADD' || op === 'SUB') {
        const isUnitA = procA && (procA.isUnit || procA.constructor.name === 'Unit');
        const isUnitB = procB && (procB.isUnit || procB.constructor.name === 'Unit');

        // STRICT MODE: Check for Matrix <-> Scalar mismatch
        // mathjs matrices have isMatrix=true or constructor.name='Matrix'
        // Scalars are numbers or BigNumbers (but not Units here if handled above, though we should be careful)
        const isMatrixA = procA && (Array.isArray(procA) || procA.isMatrix || procA.constructor.name === 'Matrix');
        const isMatrixB = procB && (Array.isArray(procB) || procB.isMatrix || procB.constructor.name === 'Matrix');

        if ((isMatrixA && !isMatrixB) || (!isMatrixA && isMatrixB)) {
            // If one is matrix and other is scalar (and not a unit-based matrix which is rare)
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

        if (result && typeof result === 'object' && ('isUnit' in result || result.constructor.name === 'Unit')) {
            const unitResult = result as any; // Cast to access Unit methods safely
            if (unitResult.isUnit || unitResult.constructor.name === 'Unit') {
                finalUnit = unitResult.formatUnits();
                try { finalValue = unitResult.toNumber(finalUnit); } catch (e) { finalValue = unitResult.value; }
                return PayloadUtils.createScalar(
                    PayloadUtils.dehydrate(finalValue),
                    finalUnit
                );
            }
        }

        // Auto-wrap result (handles Matrix, Scalar, BigNumber, etc.)
        return PayloadUtils.wrap(result);
    } catch (e: any) {
        let msg = e.message;
        // Improve Matrix Error Messages
        if (msg.includes('Dimension mismatch')) {
            if (op === 'ADD' || op === 'SUB') {
                msg = `Size Mismatch: Cannot ${op === 'ADD' ? 'Add' : 'Subtract'} different sized matrices`;
            } else if (op === 'MUL') {
                msg = `Size Mismatch: Cols A must match Rows B`;
            } else if (op === 'DIV') {
                msg = `Matrix Division is not supported`;
            }
        } else if (msg.includes('Units do not match')) {
            msg = `Unit Mismatch: Cannot combine different physical quantities (e.g. mass + length)`;
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

// MA-12: Rounding
NodeRegistry.register('MA-12', (node, inputs) => {
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

