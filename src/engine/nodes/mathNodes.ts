import { NodeRegistry } from '../NodeRegistry';
import { MathEvaluators } from './Evaluators/Math/MathEvaluators';
import { MathSymbolizers } from './Symbolizers/Math/MathSymbolizers';

export function registerMathNodes() {
    const ids = [
        // ─── 2. Generators ──────────────────────────────────────
        'IN-06', // Constant
        'IN-10', // Random

        // ─── 3. Math ────────────────────────────────────────────
        'MA-01', // Basic Math
        'MA-02', // Advanced Math
        'MA-03', // Log
        'MA-04', // Trig
        'MA-05', // Round
        'MA-06', // Fraction
        'MA-07', // Number Theory
        'MA-08', // Combinatorics

        // ─── 6. Transform ───────────────────────────────────────
        'TR-01', // Unit
        'TR-02', // Base Converter
        'TR-06', // Statistics
        'TR-05'  // Smoothing
    ];

    ids.forEach(id => {
        const evaluator = MathEvaluators[id];
        const symbolizer = MathSymbolizers[id];
        if (evaluator) {
            NodeRegistry.register(id, evaluator, symbolizer);
        } else {
            console.warn(`[MathNodes] Missing evaluator for ${id}`);
        }
    });
}

