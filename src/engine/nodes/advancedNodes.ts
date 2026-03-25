import { NodeRegistry } from '../NodeRegistry';
import { AdvancedEvaluators } from './Evaluators/Advanced/AdvancedEvaluators';
import { AdvancedSymbolizers } from './Symbolizers/Advanced/AdvancedSymbolizers';

export function registerAdvancedNodes() {
    const nodes = [
        // ─── 4. Calculus ────────────────────────────────────────
        'CL-01', // Derivative
        'CL-02', // Integral
        'CL-03', // Limit
        'CL-04', // Solver
        'CL-05', // ODE Solver

        // ─── 5. Data & Structures ───────────────────────────────
        'DT-01', // Array Builder
        'DT-02', // Array Extract
        'DT-03', // List Utility
        'DT-04', // Set Ops
        'DT-06', // Matrix Tools
        'DT-05', // Vector Utils


        // ─── 6. Transform ───────────────────────────────────────
        'TR-03', // Geometry
        'TR-04', // Vector Field

        // ─── 1. Input (Expert) ──────────────────────────────────
        'IN-09'  // Node Expression
    ];

    nodes.forEach(id => {
        const evaluator = AdvancedEvaluators[id];
        const symbolizer = AdvancedSymbolizers[id];
        if (evaluator && symbolizer) {
            NodeRegistry.register(id, evaluator, symbolizer);
        } else {
            console.warn(`[AdvancedNodes] Missing evaluator or symbolizer for ${id}`);
        }
    });
}
