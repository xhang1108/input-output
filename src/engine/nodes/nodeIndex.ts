import { registerIONodes } from './ioNodes';
import { registerMathNodes } from './mathNodes';
import { registerLogicNodes } from './logicNodes';
import { registerAdvancedNodes } from './advancedNodes';
import { registerUtilityNodes } from './utilityNodes';

/**
 * initializeNodes
 * 
 * Hub to register all specialized node categories into the central NodeRegistry.
 * This decouples the NodeRegistry from individual node implementations.
 */
import { NodeRegistry } from '../NodeRegistry';
import type { NodeEvaluator } from '../NodeRegistry';
import type { NodeLogic } from '../types/engineTypes';
import type { NodePayload } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { interpretGroup } from '../group/interpretGroup';
import { evaluateGroupCompiled } from '../group/compileGroup';

export function initializeNodes() {
    registerIONodes();
    registerMathNodes();
    registerLogicNodes();
    registerAdvancedNodes();
    registerUtilityNodes();

    // Bridge Nodes: Pass-through for Macro boundaries
    NodeRegistry.register('BRIDGE_IN', (node, inputs) => {
        // Bridge In nodes act as source internally, but externally they represent an input.
        // During evaluation (inside macro), they just return the value they were given from parents.
        return node.value || PayloadUtils.createScalar(0);
    });

    NodeRegistry.register('BRIDGE_OUT', (node, inputs) => {
        // Bridge Out nodes collect internal data to push outside.
        // They take any input from the internal graph and pass it through.
        const input = Object.values(inputs)[0];
        return input || node.value || PayloadUtils.createScalar(0);
    });

    // Group Node (P2 compiled fast path + P1 interpreter fallback,
    // GROUP_NODE_PLAN §5.2/§5.3): allowlist hit with a warm/valid cache entry
    // runs the compiled `(inputs,params,math)=>outputs` function; anything
    // else falls back to interpretGroup and is flagged unoptimized
    // (`_groupOptimized=false`, no archive/toplogical side effects).
    // The evaluator is async but NodeRegistry.evaluate awaits it; the cast
    // keeps the sync NodeEvaluator signature untouched.
    NodeRegistry.register('group', (async (node: NodeLogic, inputs: Record<string, NodePayload>) => {
        const compiled = evaluateGroupCompiled(node, inputs);
        if (compiled) {
            (node as unknown as Record<string, unknown>)._groupOptimized = true;
            return compiled;
        }
        (node as unknown as Record<string, unknown>)._groupOptimized = false;
        return interpretGroup(node, inputs);
    }) as unknown as NodeEvaluator);
}

