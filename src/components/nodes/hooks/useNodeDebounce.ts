'use client';

import { useState, useEffect, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Brain } from '../../../engine/Brain';

/**
 * Standardizes the debounce pattern for node data updates.
 * Manages local state for snappy UI and automatically syncs to store after delay.
 */
export function useNodeDebounce<T>(
    id: string,
    initialValue: T,
    onSync: (value: T) => Record<string, unknown>,
    delay: number = 300
) {
    const { updateNodeData } = useReactFlow();
    const [localValue, setLocalValue] = useState<T>(initialValue);

    // Sync from parent if value changes from outside (during render)
    const [lastInitialValue, setLastInitialValue] = useState<T>(initialValue);

    // Deep compare to avoid unnecessary syncs
    const initialValueChanged = useMemo(() =>
        JSON.stringify(initialValue) !== JSON.stringify(lastInitialValue),
        [initialValue, lastInitialValue]);

    if (initialValueChanged) {
        setLastInitialValue(initialValue);
        setLocalValue(initialValue);
    }

    useEffect(() => {
        const handler = setTimeout(() => {
            // Only sync if localValue is different from what we last received from initialValue
            if (JSON.stringify(localValue) === JSON.stringify(lastInitialValue)) return;

            const updatePayload = onSync(localValue);

            if (Object.keys(updatePayload).length > 0) {
                updateNodeData(id, updatePayload);

                // Notify Brain of the update
                Brain.getInstance().applyTransaction({
                    type: 'UPDATE_NODE_DATA',
                    payload: {
                        id,
                        data: updatePayload
                    }
                });
            }
        }, delay);

        return () => clearTimeout(handler);
    }, [localValue, id, updateNodeData, delay, onSync, lastInitialValue]);

    return [localValue, setLocalValue] as const;
}
