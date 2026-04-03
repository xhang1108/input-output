import { NodeRegistry } from '@/engine/NodeRegistry';
import { initializeNodes } from '@/engine/NodeRegistry';
import { nodeTypes } from '@/config/nodeTypeMap';

describe('NodeRegistry Stability Architect', () => {

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

        expect(missingEvaluators).toEqual([]);
    });
});

