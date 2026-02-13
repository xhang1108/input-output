
import { NodeLogic } from './types';
import { MathEngine } from './MathEngine';

type NodeEvaluator = (node: NodeLogic, inputs: Record<string, any>) => any;

export class NodeRegistry {
    private static evaluators: Map<string, NodeEvaluator> = new Map();

    public static register(type: string, evaluator: NodeEvaluator) {
        this.evaluators.set(type, evaluator);
    }

    public static getEvaluator(type: string): NodeEvaluator | undefined {
        return this.evaluators.get(type);
    }

    public static evaluate(node: NodeLogic, inputs: Record<string, any>): any {
        const evaluator = this.evaluators.get(node.type || 'baseNode');

        if (!evaluator) {
            // Fallback: If it's an INPUT node (no inputs, has value), return value.
            // But usually INPUT nodes have type 'IO-01'...
            // If unknown type, return current value (Identity).
            return node.value;
        }

        return evaluator(node, inputs);
    }
}

// --- Standard Node Implementations ---

// IO-01: Input (Scalar)
NodeRegistry.register('IO-01', (node, inputs) => {
    const engine = MathEngine.getInstance();
    return engine.processInput(node.value);
});

// IO-11: Result (Display)
NodeRegistry.register('IO-11', (node, inputs) => {
    const engine = MathEngine.getInstance();
    const val = inputs['in'] ?? 0;
    return engine.processInput(val);
});

// IO-02: Slider (Input)
NodeRegistry.register('IO-02', (node, inputs) => {
    const engine = MathEngine.getInstance();
    return engine.processInput(node.value);
});

// MA-01: Math (Add/Sub/Mul/Div)
NodeRegistry.register('MA-01', (node, inputs) => {
    const engine = MathEngine.getInstance();

    // Inputs are mapped by Handle ID. 
    // Standard Math Node usually has 'A' and 'B' handles? 
    // Or 'in_0', 'in_1'?
    // Let's assume standard names for now: 'A' and 'B'.
    // If inputs are array-based (dynamic), we might need to iterate.

    const a = inputs['A'] ?? 0;
    const b = inputs['B'] ?? 0;

    // Operation is stored in node.data? 
    // We need to access node.data.op. 
    // But NodeLogic interface currently only has `value`, `id`, `type`, `isDirty`.
    // We need to extend NodeLogic to include `data`.

    // HACK: For now, we assume 'op' is in `node['data']`.
    const op = (node as any).data?.op || 'ADD';

    return engine.evaluate(op, engine.processInput(a), engine.processInput(b));
});

