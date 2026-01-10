'use client';

import { useState, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAppStore } from '@/store/useAppStore';

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
    const { triggerLogicUpdate } = useAppStore();
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

            // Check if any value in the payload is actually different from current tracking
            // to avoid redundant updates that trigger global logic cycles.
            const hasChanges = Object.keys(updatePayload).length > 0;

            if (hasChanges) {
                lastPushedValue.current = localValue;
                updateNodeData(id, updatePayload);
                triggerLogicUpdate();
            }
        }, delay);

        return () => clearTimeout(handler);
    }, [localValue, id, updateNodeData, delay, onSync, triggerLogicUpdate]);

    return [localValue, setLocalValue] as const;
}
