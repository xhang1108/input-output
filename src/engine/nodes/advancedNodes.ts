import { NodeRegistry } from '../NodeRegistry';
import { AdvancedEvaluators } from './Evaluators/Advanced/AdvancedEvaluators';
import { AdvancedSymbolizers } from './Symbolizers/Advanced/AdvancedSymbolizers';

export function registerAdvancedNodes() {
    const nodes = [
        'AD-01', 'AD-02', 'AD-03', 'AD-04', 'AD-05',
        'AD-06', 'AD-07', 'AD-08', 'AD-09', 'AD-10',
        'AD-11', 'SY-05'
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
