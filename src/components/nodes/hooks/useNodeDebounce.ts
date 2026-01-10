'use client';

import { useState, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';

/**
 * Standardizes the debounce pattern for node data updates.
 * Manages local state for snappy UI and automatically syncs to store after delay.
 */
export function useNodeDebounce<T>(
    id: string,
    initialValue: T,
    onSync: (value: T) => Record<string, any>,
    delay: number = 300
) {
    const { updateNodeData } = useReactFlow();
    const [localValue, setLocalValue] = useState<T>(initialValue);
    const isFirstRender = useRef(true);

    // Track the last value we pushed to the global store to avoid echo-loops
    const lastPushedValue = useRef<T>(initialValue);

    // Update local state ONLY if external initialValue changes (and it's not our own echo)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Stringifying for deep comparison of matrices/objects if necessary, 
        // but for primitives/standard arrays this simple check or JSON check is safer.
        const isEcho = JSON.stringify(initialValue) === JSON.stringify(lastPushedValue.current);

        if (!isEcho) {
            setLocalValue(initialValue);
            lastPushedValue.current = initialValue;
        }
    }, [initialValue]);

    useEffect(() => {
        const handler = setTimeout(() => {
            const updatePayload = onSync(localValue);
            if (Object.keys(updatePayload).length > 0) {
                // Update our tracker before pushing so the echo check above knows it's us
                lastPushedValue.current = localValue;
                updateNodeData(id, updatePayload);
            }
        }, delay);

        return () => clearTimeout(handler);
    }, [localValue, id, updateNodeData, delay, onSync]);

    return [localValue, setLocalValue] as const;
}
