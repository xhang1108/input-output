import { NodeLogic } from './types';
import { MathEngine } from './MathEngine';
import { NodePayload, DataType } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';

// Phase 2.1: Elevate Evaluator to work with Payloads
type NodeEvaluator = (node: NodeLogic, inputs: Record<string, NodePayload>) => NodePayload;

// Phase 3: AST Generator
import { ASTNode } from '../types/payload';
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

    public static getEvaluator(type: string): NodeEvaluator | undefined {
        return this.evaluators.get(type);
    }

    public static evaluate(node: NodeLogic, inputs: Record<string, NodePayload>): NodePayload {
        const evaluator = this.evaluators.get(node.type || 'baseNode');

        if (!evaluator) {
            // Fallback: Return current value (Identity), ensuring it's a Payload
            // If node.value is already a Payload (it should be), return it.
            // But we need to be safe during migration.
            // Actually node.value IS a NodePayload now per interface.
            return node.value;
        }

        return evaluator(node, inputs);
    }

    public static getSymbol(node: NodeLogic, inputs: Record<string, ASTNode>): ASTNode {
        const symbolizer = this.symbolizers.get(node.type || 'baseNode');

        if (symbolizer) {
            return symbolizer(node, inputs);
        }

        // Default: If no symbolizer, return a Literal of the current value?
        // Or if inputs exist, maybe we can't do anything.
        // For Input Nodes (IO-01), they usually don't have inputs, so they are Literals or Identifiers.

        // If node has value, return Literal
        const val = PayloadUtils.unwrap(node.value);
        // Warning: val might be complex object.
        return PayloadUtils.createSymbol('Literal', { value: typeof val === 'object' ? 'Complex' : val });
    }
}

// --- Standard Node Implementations ---

// IO-01: Input (Scalar)
NodeRegistry.register('IO-01', (node, inputs) => {
    // Input node just holds value. 
    // It shouldn't need to process input, but user might type in it.
    // The value stored in node.value IS the source of truth.
    // Ensure it is a valid Payload.
    return node.value;
}, (node, inputs) => {
    // AST: Identifier (e.g. "x" or "5")
    // If user named it, use name. If not, use value.
    const name = node.data.label as string;
    const value = PayloadUtils.unwrap(node.value);

    if (name) {
        return PayloadUtils.createSymbol('Identifier', { name, value });
    }
    return PayloadUtils.createSymbol('Literal', { value });
});

// IO-11: Result (Display)
NodeRegistry.register('IO-11', (node, inputs) => {
    // Result node simply passes through the input for connected nodes,
    // or arguably it doesn't output anything useful for downstream?
    // It acts as a Identity for 'out' checks if needed.
    let inputPayload = inputs['in'];
    // Fallback: Use the first available input if 'in' is missing
    if (!inputPayload) {
        const keys = Object.keys(inputs);
        if (keys.length > 0) inputPayload = inputs[keys[0]];
    }

    if (!inputPayload) return PayloadUtils.createScalar(0);

    if (!inputPayload) return PayloadUtils.createScalar(0);

    // We might want to format it or attach metadata here?
    // For now, identity.
    return inputPayload;
});

// IO-05: Unit Assigner
NodeRegistry.register('IO-05', (node, inputs) => {
    const inputPayload = inputs['in'] || PayloadUtils.createScalar(0);
    const val = PayloadUtils.unwrap(inputPayload);
    const unit = node.data?.unit as string || 'm';

    // Check for existing unit in input
    const inputUnit = inputPayload.meta?.unit;

    let finalVal = Number(val);

    if (inputUnit && inputUnit !== unit) {
        // Attempt conversion
        const engine = MathEngine.getInstance();
        try {
            finalVal = engine.convertUnit(finalVal, inputUnit, unit);
        } catch (e) {
            return PayloadUtils.createError(`Cannot convert ${inputUnit} to ${unit}`);
        }
    }

    // Create new scalar with the assigned (or converted) unit
    return PayloadUtils.createScalar(finalVal, unit);
}, (node, inputs) => {
    // AST: Unit Conversion? Or just Unit Assignment.
    // Let's represent as value * unit for now?
    // Or a specific Unit Node in AST?
    // ASTNode has 'unit' field.

    const inputSymbol = inputs['in'];
    const targetUnit = node.data?.unit as string;

    // If input is already a symbol, we wrap it or modify it?
    // Let's wrap in a "Conversion" or just attach unit if it's a Literal.

    if (inputSymbol && inputSymbol.type === 'Literal') {
        return { ...inputSymbol, unit: targetUnit };
    }

    // If expression, maybe (Expr) [unit]?
    // For now, return input symbol but with unit overridden?
    // Or wrap in a function call `toUnit(expr, unit)`?
    return PayloadUtils.createSymbol('FunctionCall', {
        name: 'toUnit',
        argument: inputSymbol, // TODO: Array for arguments
        unit: targetUnit
    });
});

// IO-02: Slider (Input)
NodeRegistry.register('IO-02', (node, inputs) => {
    return node.value;
});


// MA-01: Math (Add/Sub/Mul/Div)
// MA-01: Math (Add/Sub/Mul/Div)
NodeRegistry.register('MA-01', (node, inputs) => {
    const engine = MathEngine.getInstance();
    // Access the raw mathjs instance for manual hydration
    // We need to expose it from MathEngine or import it.
    // Assuming MathEngine has a public getter or we can use a static import if available.
    // For now, let's assume engine.math is available or we add it to MathEngine.
    // Actually, looking at MathEngine, it probably encapsulates it. 
    // Let's add a public accessor to MathEngine for 'math' instance in the next step if needed.
    // BUT! engine.evaluate takes numbers/units.
    // Let's stick to using PayloadUtils.hydrate -> engine.evaluate -> PayloadUtils.dehydrate.

    // 1. Unwrap Inputs
    const payloadA = inputs['in_a'];
    const payloadB = inputs['in_b'];

    if (!payloadA && !payloadB) {
        return PayloadUtils.createScalar(0);
    }

    const rawA = payloadA ? PayloadUtils.unwrap(payloadA) : 0;
    const rawB = payloadB ? PayloadUtils.unwrap(payloadB) : 0;

    // 2. Hydrate for Calculation (Phase 2.6 Serialization)
    // We need the math instance to hydrate properly.
    const mathInstance = engine.getMathInstance(); // We will add this to MathEngine
    const valA = PayloadUtils.hydrate(rawA, mathInstance);
    // Auto-fix for Unit + 0
    // If valA is Unit and rawB is 0, we might need to treat B as 0 Unit.
    // But hydrate handles the structure.
    const valB = PayloadUtils.hydrate(rawB, mathInstance);

    // 3. Compute
    const op = node.data?.op || 'ADD';
    let result;
    try {
        // We need to be careful. engine.evaluate expects... what?
        // It expects primitives or mathjs objects? 
        // In previous code `engine.processInput` created Units.
        // Now `hydrate` creates Units/BigNumbers.

        // Let's ensure compatibility.
        // If we pass hydrated objects to engine.evaluate, it should work if evaluate uses math.add(a, b).

        // Unit + 0 Logic (Legacy Support for mixed types)
        // If valA is Unit and valB is number 0, mathjs might fail on add.
        // Let's keep the engine.processInput logic OR move it here?
        // Better to rely on valid hydration.

        // Use engine.evaluateRaw? Or just engine.evaluate?
        // engine.evaluate does: return this.math[op](a, b);
        // So passing hydrated objects is correct.

        result = engine.evaluate(op, valA, valB);
    } catch (e) {
        return PayloadUtils.createError((e as Error).message);
    }

    // 4. Dehydrate Result (Serialization First)
    const safeResult = PayloadUtils.dehydrate(result);

    // 5. Construct Payload (No AST by default)
    // We still want to extract a clean Unit string for the UI 'meta' if possible.
    let finalUnit: string | undefined;
    if (result && typeof result === 'object' && result.isUnit) {
        finalUnit = result.formatUnits();
    }

    return {
        type: (safeResult && typeof safeResult === 'object' && 'mathjs' in safeResult)
            ? DataType.Object // Or specific type like Matrix?
            : DataType.Scalar, // Simplification
        value: safeResult,
        symbol: null, // On-Demand AST: Null by default!
        meta: { unit: finalUnit }
    };
}, (node, inputs) => {
    // AST: Binary Expression
    const L = inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 });
    const R = inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 });
    const op = node.data?.op || 'ADD';

    return PayloadUtils.createSymbol('BinaryExpression', {
        operator: op,
        left: L,
        right: R
    });
});
