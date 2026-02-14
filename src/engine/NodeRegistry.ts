import { NodeLogic } from './types';
import { MathEngine } from './MathEngine';
import { NodePayload } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';

// Phase 2.1: Elevate Evaluator to work with Payloads
type NodeEvaluator = (node: NodeLogic, inputs: Record<string, NodePayload>) => NodePayload;

export class NodeRegistry {
    private static evaluators: Map<string, NodeEvaluator> = new Map();

    public static register(type: string, evaluator: NodeEvaluator) {
        this.evaluators.set(type, evaluator);
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
}

// --- Standard Node Implementations ---

// IO-01: Input (Scalar)
NodeRegistry.register('IO-01', (node, inputs) => {
    // Input node just holds value. 
    // It shouldn't need to process input, but user might type in it.
    // The value stored in node.value IS the source of truth.
    // Ensure it is a valid Payload.
    return node.value;
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
});

// IO-02: Slider (Input)
NodeRegistry.register('IO-02', (node, inputs) => {
    return node.value;
});


// MA-01: Math (Add/Sub/Mul/Div)
NodeRegistry.register('MA-01', (node, inputs) => {
    const engine = MathEngine.getInstance();

    // 1. Unwrap Inputs — match handle IDs from nodeDefinitions (in_a, in_b)
    const payloadA = inputs['in_a'];
    const payloadB = inputs['in_b'];

    // Fix: If no inputs are connected, return 0 data immediately
    // This prevents 0/0 = NaN for DIV/MOD operations when disconnected
    if (!payloadA && !payloadB) {
        return PayloadUtils.createScalar(0);
    }

    // Default to 0 for unconnected inputs
    const rawA = payloadA ? PayloadUtils.unwrap(payloadA) : 0;
    const rawB = payloadB ? PayloadUtils.unwrap(payloadB) : 0;

    // 2. Convert to engine-compatible type (BigNumber in scientific mode)
    //    Raw JS numbers crash mathjs's tree-shaken addScalar in BigNumber mode.
    // 3. Compute via MathEngine
    // 3. Compute via MathEngine
    const op = node.data?.op || 'ADD';
    let result;
    try {
        // Phase 2.4: Physics-Aware Math
        // Pass unit metadata to MathEngine to create Unit objects
        const unitA = payloadA?.meta?.unit;
        const unitB = payloadB?.meta?.unit;

        // Auto-fix for Unit + 0 or Unit - 0
        // If one side is a Unit and the other is 0 (missing input), mathjs fails.
        // We must treat the 0 as "0 [unit]".
        let valA = engine.processInput(rawA, unitA);
        let valB = engine.processInput(rawB, unitB);

        if (unitA && !unitB && rawB === 0 && (op === 'ADD' || op === 'SUB')) {
            // A is Unit, B is 0. Treat B as 0 [unitA]
            valB = engine.processInput(0, unitA);
        } else if (!unitA && unitB && rawA === 0 && (op === 'ADD' || op === 'SUB')) {
            // A is 0, B is Unit. Treat A as 0 [unitB]
            valA = engine.processInput(0, unitB);
        }

        result = engine.evaluate(op, valA, valB);
    } catch (e) {
        return PayloadUtils.createError((e as Error).message);
    }

    // 4. Wrap Result
    let numResult: number;
    let finalUnit: string | undefined;

    // Handle Unit Logic Result (math.Unit)
    if (result && typeof result === 'object' && result.isUnit) {
        // If result is a Unit, we need to extract value and unit string
        try {
            numResult = result.toNumber(result.formatUnits()); // Convert to base?
            // Actually, let's keep it simple.
            // mathjs result.toString() -> "2 m"
            // result.toNumber('unit') -> value

            // We want to preserve the unit structure.
            // result.toJSON() -> { mathjs: 'Unit', value, unit, fixPrefix? }
            // Let's use toNumeric if possible? No.

            // Strategy:
            // 1. Get Value in canonical unit? Or first input's unit?
            // Let's normalize to the unit of the first operand if compatible, or SI.
            // For now, let mathjs decide, then extract.

            // Extract Unit String
            const unitStr = result.formatUnits(); // e.g. "m" or "m / s"
            finalUnit = unitStr;

            // Extract Number
            numResult = result.toNumber(unitStr);
        } catch (err) {
            // Fallback for complex units
            numResult = result.toNumber(); // Might fail if unit exists?
            finalUnit = result.formatUnits();
        }
    } else if (typeof result === 'object' && result !== null && 'toNumber' in (result as any)) {
        // BigNumber
        numResult = (result as any).toNumber();
        finalUnit = undefined; // No unit from mathjs (scalars)
    } else {
        numResult = Number(result);
        finalUnit = undefined;
    }

    // 5. Unit Propagation (Phase 2.0.4 -> 2.4)
    // If mathjs returned a unit, use it.
    // If NOT (e.g. 5m / 5m = 1), finalUnit is empty string or undefined.
    // However, if we fall back to manual merge (for scalar ops), usage is:
    if (!finalUnit) {
        const unitA = payloadA?.meta?.unit;
        const unitB = payloadB?.meta?.unit;
        // If we had units but lost them (e.g. cancellation), that's fine.
        // But if we processed as scalars (no units in inputs), we attempt mergeUnits?
        // MathEngine.processInput(rawA, unitA) handles unit creation.
        // If units were present, result WOULD be a Unit (or scalar if cancelled).
        // So manual mergeUnits might be redundant or conflicting.
        // Let's rely on mathjs for now.
    }

    // 6. AST Generation
    const unitA = payloadA?.meta?.unit;
    const unitB = payloadB?.meta?.unit;

    // ... (AST generation logic remains similar, maybe update to reflect units) ...
    const astA = payloadA?.symbol || PayloadUtils.createSymbol('Literal', { value: rawA, unit: unitA });
    const astB = payloadB?.symbol || PayloadUtils.createSymbol('Literal', { value: rawB, unit: unitB });

    const newSymbol = PayloadUtils.createSymbol('BinaryExpression', {
        operator: op,
        left: astA,
        right: astB
    });

    const outputPayload = PayloadUtils.createScalar(numResult, finalUnit);
    outputPayload.symbol = newSymbol;

    return outputPayload;
});
