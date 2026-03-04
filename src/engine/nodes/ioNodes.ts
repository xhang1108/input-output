import { NodeRegistry } from '../NodeRegistry';
import { IOEvaluators } from './Evaluators/IO/IOEvaluators';
import { IOSymbolizers } from './Symbolizers/IO/IOSymbolizers';

export function registerIONodes() {
    // ─── 1. Input ──────────────────────────────────────────
    NodeRegistry.register('IO-01', IOEvaluators['IO-01'], IOSymbolizers['IO-01']); // Number
    NodeRegistry.register('IO-02', IOEvaluators['IO-02'], IOSymbolizers['IO-02']); // Slider
    NodeRegistry.register('IO-04', IOEvaluators['IO-04'], IOSymbolizers['IO-04']); // String
    NodeRegistry.register('IO-08', IOEvaluators['IO-08'], IOSymbolizers['IO-08']); // Matrix Input
    NodeRegistry.register('IO-18', IOEvaluators['IO-18'], IOSymbolizers['IO-18']); // Color
    NodeRegistry.register('IO-21', IOEvaluators['IO-21'], IOSymbolizers['IO-21']); // Abacus

    // ─── 8. Output ──────────────────────────────────────────
    NodeRegistry.register('IO-11', IOEvaluators['IO-11'], IOSymbolizers['IO-11']); // Result
    NodeRegistry.register('IO-14', IOEvaluators['IO-14']); // Plot
    NodeRegistry.register('IO-22', IOEvaluators['IO-22']); // Status
    NodeRegistry.register('IO-16', IOEvaluators['IO-16'], IOSymbolizers['IO-16']); // Fallback
}
