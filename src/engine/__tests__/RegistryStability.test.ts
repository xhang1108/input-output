import { NodeRegistry } from '../NodeRegistry';
import { initializeNodes } from '../NodeRegistry';
import { nodeTypes } from '../../config/nodeTypeMap';

describe('NodeRegistry Stability Architect', () => {
    beforeAll(() => {
        // 1. Initialize all distributed nodes
        initializeNodes();
    });

    it('should have an evaluator registered for every Node mapping in nodeTypes', () => {
        // nodeTypes maps string IDs (e.g. 'MA-01') to React components.
        // Even if some render a fallback baseNode, the underlying Engine Type ID must have a matching Evaluator
        // if it is expected to process data.

        const expectedIds = Object.keys(nodeTypes);

        // Expose the private evaluators map for testing purposes using any cast
        const registeredKeys = Array.from((NodeRegistry as any).evaluators.keys());

        const missingEvaluators: string[] = [];

        for (const expectedId of expectedIds) {
            // Some UI/Structural nodes don't need evaluators. We skip these known exceptions.
            const structuralWhitelist = [
                'magnetic', // Edge type, not a logical node
                'baseNode', // Base render fallback
                'frame'     // React Flow built-in structural frame
            ];

            if (structuralWhitelist.includes(expectedId)) {
                continue;
            }

            if (!registeredKeys.includes(expectedId)) {
                missingEvaluators.push(expectedId);
            }
        }

        // We assert that the list of missing evaluators must be exactly 0 (or match accepted legacy exceptions)
        // Currently IO-17 is a known legacy fallback that was deliberately dropped. We can document it here.
        const acceptableLegacyDrops = ['IO-17'];

        const trueMissing = missingEvaluators.filter(id => !acceptableLegacyDrops.includes(id));

        expect(trueMissing).toEqual([]);
    });
});
