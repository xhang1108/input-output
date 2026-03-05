import { NodeRegistry } from '../NodeRegistry';
import { IOEvaluators } from './Evaluators/IO/IOEvaluators';
import { IOSymbolizers } from './Symbolizers/IO/IOSymbolizers';

export function registerIONodes() {
    // ─── 1. Input ──────────────────────────────────────────
    NodeRegistry.register('IN-01', IOEvaluators['IO-01'], IOSymbolizers['IO-01']); // Number
    NodeRegistry.register('IN-02', IOEvaluators['IO-02'], IOSymbolizers['IO-02']); // Slider
    NodeRegistry.register('IN-04', IOEvaluators['IO-04'], IOSymbolizers['IO-04']); // String
    NodeRegistry.register('IN-07', IOEvaluators['IO-08'], IOSymbolizers['IO-08']); // Matrix Input
    NodeRegistry.register('IN-03', IOEvaluators['IO-18'], IOSymbolizers['IO-18']); // Color
    NodeRegistry.register('IN-08', IOEvaluators['IO-21'], IOSymbolizers['IO-21']); // Abacus

    // ─── 8. Output ──────────────────────────────────────────
    NodeRegistry.register('OT-01', IOEvaluators['IO-11'], IOSymbolizers['IO-11']); // Result
    NodeRegistry.register('OT-03', IOEvaluators['IO-14']); // Plot
    NodeRegistry.register('OT-02', IOEvaluators['IO-22']); // Status
    NodeRegistry.register('IO-16', IOEvaluators['IO-16'], IOSymbolizers['IO-16']); // Fallback (Keeping old ID for now if used internally)
}
