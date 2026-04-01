import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '../Brain';
import { NODE_DEFINITIONS } from '../../definitions/nodeDefinitions';
import { getHandleVariant } from '../../utils/handleUtils';

describe('Capsule Registry Guard', () => {
    let brain: Brain;

    beforeEach(() => {
        brain = Brain.getComputeSession('test-capsule');
        brain.silentReset();
    });

    // Automatically audit ALL nodes in the system for Capsule compliance
    NODE_DEFINITIONS.forEach(def => {
        const capsuleHandles = def.handles.filter(h => h.variant === 'capsule');
        
        if (capsuleHandles.length > 0) {
            describe(`Node: ${def.label} (${def.id})`, () => {
                capsuleHandles.forEach(h => {
                    it(`should enable multi-input for handle "${h.id}"`, () => {
                        // 1. Verify variant detection
                        const mockNode = { id: 'test_node', type: def.id };
                        expect(getHandleVariant(mockNode, h.id)).toBe('capsule');

                        // 2. Verify connection validation logic
                        brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'target', type: def.id } });
                        brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'source1', type: 'IN-01' } });
                        brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'source2', type: 'IN-01' } });

                        // First connection
                        const edge1 = { id: 'e1', source: 'source1', sourceHandle: 'out', target: 'target', targetHandle: h.id };
                        const v1 = brain.validateConnection('source1', 'out', 'target', h.id, []);
                        expect(v1.isValid).toBe(true);
                        brain.applyTransaction({ type: 'CONNECT', payload: edge1 });

                        // SECOND connection (This must be valid for Capsules)
                        const v2 = brain.validateConnection('source2', 'out', 'target', h.id, brain.getEdges());
                        expect(v2.isValid, `Handle "${h.id}" on node "${def.id}" failed multi-input validation`).toBe(true);
                        
                        brain.applyTransaction({ type: 'CONNECT', payload: { id: 'e2', source: 'source2', sourceHandle: 'out', target: 'target', targetHandle: h.id } });
                        expect(brain.getEdges().length).toBe(2);
                    });
                });
            });
        }
    });

    it('should block multiple connections for standard "single" handles (e.g., MA-01)', () => {
         brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'math', type: 'MA-01' } });
         brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'in1', type: 'IN-01' } });
         brain.applyTransaction({ type: 'ADD_NODE', payload: { id: 'in2', type: 'IN-01' } });

         const edge1 = { id: 'e1', source: 'in1', sourceHandle: 'out', target: 'math', targetHandle: 'in_a' };
         brain.applyTransaction({ type: 'CONNECT', payload: edge1 });
         
         const validation2 = brain.validateConnection('in2', 'out', 'math', 'in_a', brain.getEdges());
         expect(validation2.isValid).toBe(false);
         expect(validation2.reason).toBe('Handle already connected');
    });
});
