import { registerIONodes } from './ioNodes';
import { registerMathNodes } from './mathNodes';
import { registerLogicNodes } from './logicNodes';
import { registerAdvancedNodes } from './advancedNodes';
import { registerUtilityNodes } from './utilityNodes';

/**
 * 💡 initializeNodes
 * 
 * Hub to register all specialized node categories into the central NodeRegistry.
 * This decouples the NodeRegistry from individual node implementations.
 */
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';

export function initializeNodes() {
    registerIONodes();
    registerMathNodes();
    registerLogicNodes();
    registerAdvancedNodes();
    registerUtilityNodes();

    // 💡 Bridge Nodes: Pass-through for Macro boundaries
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
}
