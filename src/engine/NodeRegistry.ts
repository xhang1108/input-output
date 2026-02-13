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
    const inputPayload = inputs['in'];
    if (!inputPayload) return PayloadUtils.createScalar(0);

    // We might want to format it or attach metadata here?
    // For now, identity.
    return inputPayload;
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

    // Default to 0 for unconnected inputs
    const rawA = payloadA ? PayloadUtils.unwrap(payloadA) : 0;
    const rawB = payloadB ? PayloadUtils.unwrap(payloadB) : 0;

    // 2. Convert to engine-compatible type (BigNumber in scientific mode)
    //    Raw JS numbers crash mathjs's tree-shaken addScalar in BigNumber mode.
    const valA = engine.processInput(rawA);
    const valB = engine.processInput(rawB);

    // 3. Compute via MathEngine
    const op = node.data?.op || 'ADD';
    let result;
    try {
        result = engine.evaluate(op, valA, valB);
    } catch (e) {
        return PayloadUtils.createError((e as Error).message);
    }

    // 4. Wrap Result — convert back to plain number for payload storage
    const numResult = typeof result === 'object' && result !== null && 'toNumber' in result
        ? result.toNumber()
        : Number(result);
    return PayloadUtils.createScalar(numResult);
});
