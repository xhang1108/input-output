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
export function initializeNodes() {
    registerIONodes();
    registerMathNodes();
    registerLogicNodes();
    registerAdvancedNodes();
    registerUtilityNodes();
}
