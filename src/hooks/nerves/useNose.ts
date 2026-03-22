'use client';

import { useCallback } from 'react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { DataType } from '../../types/payload';

/**
 * useNose (The Sniffer Organ)
 * Responsible for detecting data types and property "scents" in the graph.
 * Doesn't strictly block connections but provides metadata for visual feedback.
 */
export function useNose() {
    const brain = useBrain();
    const getBrain = useCallback(() => brain, [brain]);

    /**
     * Identifies the data type of a specific node's current value.
     */
    const sniffType = useCallback((nodeId: string): DataType => {
        const brain = getBrain();
        const payload = brain.peekValue(nodeId);
        return payload?.type || DataType.Scalar;
    }, [getBrain]);

    /**
     * Gets the current value metadata (unit, dimensions, etc.)
     */
    const sniffMeta = useCallback((nodeId: string) => {
        const brain = getBrain();
        const payload = brain.peekValue(nodeId);
        return payload?.meta || {};
    }, [getBrain]);

    /**
     * Checks if a connection between two handles is "smelly" (mismatched types).
     * Returns a recommendation/warning instead of a strict boolean.
     */
    const sniffConnectionScent = useCallback((sourceNodeId: string, targetNodeId: string) => {
        const sourceType = sniffType(sourceNodeId);
        const targetType = sniffType(targetNodeId);

        if (sourceType === 'error' || targetType === 'error') {
            return { quality: 'bad', message: 'Connection involves an error state.' };
        }

        if (sourceType !== targetType) {
            return {
                quality: 'warn',
                message: `Type mismatch: ${sourceType} -> ${targetType}. Auto-casting may occur.`
            };
        }

        return { quality: 'good', message: 'Compatible types.' };
    }, [sniffType]);

    return {
        sniffType,
        sniffMeta,
        sniffConnectionScent
    };
}
