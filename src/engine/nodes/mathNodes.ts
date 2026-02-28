import { NodeRegistry } from '../NodeRegistry';
import { MathEvaluators } from './Evaluators/Math/MathEvaluators';
import { MathSymbolizers } from './Symbolizers/Math/MathSymbolizers';

export function registerMathNodes() {
    const ids = [
        'MA-01', 'MA-03', 'MA-14', 'MA-12', 'MA-02', 'MA-15', 'MA-16',
        'DA-01', 'DA-02', 'DA-03', 'DA-04', 'DA-05', 'DA-06', 'DA-07',
        'SY-04'
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
