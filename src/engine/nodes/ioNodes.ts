import { NodeRegistry } from '../NodeRegistry';
import { IOEvaluators } from './Evaluators/IO/IOEvaluators';
import { IOSymbolizers } from './Symbolizers/IO/IOSymbolizers';

export function registerIONodes() {
    NodeRegistry.register('IO-01', IOEvaluators['IO-01'], IOSymbolizers['IO-01']);
    NodeRegistry.register('IO-04', IOEvaluators['IO-04'], IOSymbolizers['IO-04']);
    NodeRegistry.register('IO-11', IOEvaluators['IO-11'], IOSymbolizers['IO-11']);
    NodeRegistry.register('IO-08', IOEvaluators['IO-08'], IOSymbolizers['IO-08']);
    NodeRegistry.register('IO-18', IOEvaluators['IO-18'], IOSymbolizers['IO-18']);
    NodeRegistry.register('IO-19', IOEvaluators['IO-19']); // No symbolizer for IO-19
    NodeRegistry.register('IO-16', IOEvaluators['IO-16'], IOSymbolizers['IO-16']);
    NodeRegistry.register('IO-05', IOEvaluators['IO-05'], IOSymbolizers['IO-05']);
    NodeRegistry.register('IO-02', IOEvaluators['IO-02'], IOSymbolizers['IO-02']);
    NodeRegistry.register('IO-06', IOEvaluators['IO-06'], IOSymbolizers['IO-06']);
    NodeRegistry.register('IO-21', IOEvaluators['IO-21'], IOSymbolizers['IO-21']);
    NodeRegistry.register('IO-14', IOEvaluators['IO-14']); // Plot Node
}
