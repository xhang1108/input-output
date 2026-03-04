import { NodeRegistry } from '../NodeRegistry';
import { AdvancedEvaluators } from './Evaluators/Advanced/AdvancedEvaluators';
import { AdvancedSymbolizers } from './Symbolizers/Advanced/AdvancedSymbolizers';

export function registerAdvancedNodes() {
    const nodes = [
        // ─── 4. Calculus ────────────────────────────────────────
        'AD-04', // Derivative
        'AD-05', // Integral
        'AD-11', // Limit
        'AD-06', // Solver
        'SY-04', // ODE Solver

        // ─── 5. Data & Structures ───────────────────────────────
        'DA-07', // Array Builder
        'DA-06', // Array Extract
        'DA-03', // List Utility
        'DA-04', // Set Ops
        'AD-01', // Matrix Tools
        'AD-02', // Vector Utils
        'AD-09', // Vector Split

        // ─── 6. Transform ───────────────────────────────────────
        'AD-10', // Geometry
        'AD-08', // Vector Field

        // ─── 1. Input (Expert) ──────────────────────────────────
        'SY-05'  // Node Expression
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
