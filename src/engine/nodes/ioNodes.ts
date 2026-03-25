import { NodeRegistry } from '../NodeRegistry';
import { IOEvaluators } from './Evaluators/IO/IOEvaluators';
import { IOSymbolizers } from './Symbolizers/IO/IOSymbolizers';

export function registerIONodes() {
    // ─── 1. Input ──────────────────────────────────────────
    NodeRegistry.register('IN-01', IOEvaluators['IN-01'], IOSymbolizers['IN-01']); // Number
    NodeRegistry.register('IN-02', IOEvaluators['IN-02'], IOSymbolizers['IN-02']); // Slider
    NodeRegistry.register('IN-04', IOEvaluators['IN-04'], IOSymbolizers['IN-04']); // String
    NodeRegistry.register('IN-07', IOEvaluators['IN-07'], IOSymbolizers['IN-07']); // Matrix Input
    NodeRegistry.register('IN-03', IOEvaluators['IN-03'], IOSymbolizers['IN-03']); // Color
    NodeRegistry.register('IN-08', IOEvaluators['IN-08'], IOSymbolizers['IN-08']); // Abacus

    // ─── 8. Output ──────────────────────────────────────────
    NodeRegistry.register('OT-01', IOEvaluators['OT-01'], IOSymbolizers['OT-01']); // Result
    NodeRegistry.register('OT-03', IOEvaluators['OT-03'], IOSymbolizers['OT-03'] || undefined); // Plot
    NodeRegistry.register('OT-02', IOEvaluators['OT-02'], IOSymbolizers['OT-02'] || undefined); // Status
    NodeRegistry.register('IO-16', IOEvaluators['IO-16'], IOSymbolizers['IO-16']); // Fallback

    // ─── Legacy Aliases (Support for older tests) ──────────
    NodeRegistry.register('IO-01', IOEvaluators['IN-01'], IOSymbolizers['IN-01']); // Number
    NodeRegistry.register('IO-02', IOEvaluators['IN-02'], IOSymbolizers['IN-02']); // Slider
    NodeRegistry.register('IO-04', IOEvaluators['IN-04'], IOSymbolizers['IN-04']); // String
    NodeRegistry.register('IO-08', IOEvaluators['IN-07'], IOSymbolizers['IN-07']); // Matrix Input
    NodeRegistry.register('IO-18', IOEvaluators['IN-03'], IOSymbolizers['IN-03']); // Color
    NodeRegistry.register('IO-21', IOEvaluators['IN-08'], IOSymbolizers['IN-08']); // Abacus
    NodeRegistry.register('IO-11', IOEvaluators['OT-01'], IOSymbolizers['OT-01']); // Result
    NodeRegistry.register('IO-14', IOEvaluators['OT-03'], IOSymbolizers['OT-03'] || undefined); // Plot
    NodeRegistry.register('IO-22', IOEvaluators['OT-02'], IOSymbolizers['OT-02'] || undefined); // Status
    NodeRegistry.register('IO-05', IOEvaluators['TR-01'], IOSymbolizers['TR-01']); // Unit
    NodeRegistry.register('IO-12', IOEvaluators['MA-06'] || undefined); // Fraction (Alias)
    NodeRegistry.register('IO-19', IOEvaluators['IO-19']); // Color Split
    NodeRegistry.register('IO-23', IOEvaluators['IO-23']); // Abacus Sum
}
