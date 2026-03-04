import { NodeRegistry } from '../NodeRegistry';
import { MathEvaluators } from './Evaluators/Math/MathEvaluators';
import { MathSymbolizers } from './Symbolizers/Math/MathSymbolizers';

export function registerMathNodes() {
    const ids = [
        // ─── 2. Generators ──────────────────────────────────────
        'IO-06', // Random
        'DA-05', // Distributions

        // ─── 3. Math ────────────────────────────────────────────
        'MA-01', // Math Node
        'MA-16', // Log
        'MA-17', // Trig
        'MA-14', // Round
        'MA-12', // Fraction
        'MA-02', // Number Theory

        // ─── 6. Transform ───────────────────────────────────────
        'IO-05', // Unit
        'MA-15', // Base Converter
        'DA-01', // Statistics
        'DA-02'  // Smoothing
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
