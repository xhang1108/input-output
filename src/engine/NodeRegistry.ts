import { NodeLogic } from './types';
import { InputOutputEngine } from './InputOutputEngine';
import { NodePayload, DataType, ASTNode } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';
import { NerdamerService } from './calculus/NerdamerService';
import { RuntimeGuard } from './calculus/RuntimeGuard';

/**
 * NodeRegistry: The Brain's Cortex
 * 
 * Manages the registration and execution of node evaluators and symbolizers.
 * Supports auto-propagation of symbolic ASTs for formula generation.
 */

export type NodeEvaluator = (node: NodeLogic, inputs: Record<string, NodePayload>) => Promise<NodePayload> | NodePayload;
export type NodeSymbolizer = (node: NodeLogic, inputs: Record<string, ASTNode>) => ASTNode;

export class NodeRegistry {
    private static evaluators: Map<string, NodeEvaluator> = new Map();
    private static symbolizers: Map<string, NodeSymbolizer> = new Map();

    public static registerMany(registrations: { id: string; evaluator: NodeEvaluator; symbolizer: NodeSymbolizer }[]) {
        registrations.forEach(r => this.register(r.id, r.evaluator, r.symbolizer));
    }

    /**
     * initializeNodes
     * Static access to the global initialization hub.
     */
    static initializeNodes() {
        initNodes();
    }

    public static register(type: string, evaluator: NodeEvaluator, symbolizer?: NodeSymbolizer) {
        this.evaluators.set(type, evaluator);
        if (symbolizer) {
            this.symbolizers.set(type, symbolizer);
        }
    }

    public static async evaluate(node: NodeLogic, inputs: Record<string, NodePayload>): Promise<NodePayload> {

        // Mute Bypass Logic: If muted, pass through the primary input ONLY
        const data = (node.data || {}) as Record<string, unknown>;
        if (data.muted) {
            const primaryInput = inputs['in_a'];
            if (primaryInput) return primaryInput;

            // If primary input is missing, return a clean zero (don't leak old state)
            return PayloadUtils.createScalar(0);
        }

        const type = node.type || 'baseNode';
        const evaluator = this.evaluators.get(type);
        if (!evaluator) {
            console.warn(`[NodeRegistry] No evaluator for type: ${type}. Registered keys:`, Array.from(this.evaluators.keys()));
        }
        const result = evaluator ? await evaluator(node, inputs) : node.value;

        if (!result) return node.value || PayloadUtils.createScalar(0);

        // Auto-attach symbol if not already present
        if (result && typeof result === 'object' && result.symbol === null) {
            const inputSymbols: Record<string, ASTNode> = {};
            for (const [key, p] of Object.entries(inputs)) {
                if (!p) continue;
                if (Array.isArray(p)) {
                    // Capsule input: Multiple payloads
                    (inputSymbols as any)[key] = p.map(item => {
                        if (item.symbol) return item.symbol;
                        const val = PayloadUtils.unwrap(item);
                        return PayloadUtils.createSymbol('Literal', { value: (typeof val === 'object' ? 'Object' : val) as string | number | boolean | undefined });
                    });
                } else if (p.symbol) {
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

import { initializeNodes as initNodes } from './nodes/nodeIndex';

// Export the initialization function from nodeIndex
export { initNodes as initializeNodes };

// IO-11: Result (Display)
