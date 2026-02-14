
import { Edge, Connection } from '@xyflow/react';
import { Brain } from './Brain';

export class BrainHelper {
    /**
     * Checks if a connection is valid, handling strict 1-to-1 input rules by 
     * identifying if an existing edge needs to be replaced.
     * 
     * @param params The proposed connection (Source -> Target)
     * @param edges The current list of edges in the graph
     * @returns Object containing validity, reason, and any edge that would be replaced.
     */
    static checkConnectionWithReplacement(
        params: Connection | Edge,
        edges: Edge[]
    ): { isValid: boolean; reason?: string; edgeToReplace?: Edge } {

        const brain = Brain.getInstance();
        const { source, sourceHandle, target, targetHandle } = params;

        if (!source || !target) {
            return { isValid: false, reason: 'Incomplete connection data' };
        }

        // 1. Identify Conflict
        // Check if the Target Handle (Input) is already occupied.
        // We only care about Target constraints for 1-to-1.

        // Note: We perform this check manually here because we need to know WHICH edge to replace.
        // Brain.validateConnection just says "Occupied", it doesn't return the conflicting edge.

        const existingEdge = edges.find(e =>
            e.target === target &&
            e.targetHandle === targetHandle
        );

        // 2. Prepare Validation Context
        // If there is an existing edge, we temporarily "remove" it to see if the NEW connection would be valid.
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
