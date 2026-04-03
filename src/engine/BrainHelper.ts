import { Edge, Connection } from '@xyflow/react';
import { Brain } from './Brain';
import { getHandleVariant } from '../utils/handleUtils';

export class BrainHelper {
    /**
     * Checks if a connection is valid, handling strict 1-to-1 input rules by 
     * identifying if an existing edge needs to be replaced.
     * 
     * For 'capsule' variant handles (multi-input), NO replacement occurs.
     * 
     * @param brain The Brain instance (session-aware)
     * @param params The proposed connection (Source -> Target)
     * @param edges The current list of edges in the graph
     * @returns Object containing validity, reason, and any edge that would be replaced.
     */
    static checkConnectionWithReplacement(
        brain: Brain,
        params: Connection | Edge,
        edges: Edge[]
    ): { isValid: boolean; reason?: string; edgeToReplace?: Edge } {

        const { source, sourceHandle, target, targetHandle } = params;

        if (!source || !target) {
            return { isValid: false, reason: 'Incomplete connection data' };
        }

        const targetNodeData = brain.getNode(target);
        const variant = getHandleVariant(targetNodeData, targetHandle || '');

        // For capsule handles: no replacement, just validate directly
        if (variant === 'capsule') {
            const validation = brain.validateConnection(
                source, sourceHandle, target, targetHandle, edges
            );
            return {
                isValid: validation.isValid,
                reason: validation.reason,
                edgeToReplace: undefined  // NEVER replace for capsule
            };
        }

        // 1. Identify Conflict (single-input handles only)
        const existingEdge = edges.find(e =>
            e.target === target &&
            e.targetHandle === targetHandle
        );

        // 2. Prepare Validation Context
        const edgesForValidation = existingEdge
            ? edges.filter(e => e.id !== existingEdge.id)
            : edges;

        // 3. Ask Brain
        const validation = brain.validateConnection(
            source, sourceHandle, target, targetHandle, edgesForValidation
        );

        return {
            isValid: validation.isValid,
            reason: validation.reason,
            edgeToReplace: existingEdge
        };
    }
}

