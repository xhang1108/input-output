'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Brain } from '../../../engine/Brain';
import { useBrain } from '../../../context/BrainContext';
import deepEqual from 'fast-deep-equal';

/**
 * Standardizes the debounce pattern for node data updates.
 * Manages local state for snappy UI and automatically syncs to store after delay.
 */
export function useNodeUpdate<T>(
    id: string,
    initialValue: T,
    onSync: (value: T) => Record<string, unknown>,
    delay: number = 300,
    options: { mode?: 'debounce' | 'throttle' } = { mode: 'debounce' }
) {
    const brain = useBrain();
    const { updateNodeData } = useReactFlow();
    const [localValue, setLocalValue] = useState<T>(initialValue);
    const lastSyncTime = useRef<number>(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync from parent if value changes from outside (during render)
    const [lastInitialValue, setLastInitialValue] = useState<T>(initialValue);

    // Deep compare to avoid unnecessary syncs
    const initialValueChanged = useMemo(() =>
        !deepEqual(initialValue, lastInitialValue),
        [initialValue, lastInitialValue]);

    if (initialValueChanged) {
        setLastInitialValue(initialValue);
        setLocalValue(initialValue);
    }

    const syncToBrain = useCallback((value: T) => {
        // Only sync if localValue is different from what we last received from initialValue
        if (deepEqual(value, lastInitialValue)) return;

        const updatePayload = onSync(value);

        if (Object.keys(updatePayload).length > 0) {
            updateNodeData(id, updatePayload);

            // Notify Brain of the update
            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: {
                    id,
                    data: updatePayload
                }
            });
            lastSyncTime.current = Date.now();
        }
    }, [id, brain, updateNodeData, onSync, lastInitialValue]);

    useEffect(() => {
        if (options.mode === 'throttle') {
            const now = Date.now();
            const timeSinceLastSync = now - lastSyncTime.current;

            if (timeSinceLastSync >= delay) {
                // Immediate sync if we haven't synced in a while
                syncToBrain(localValue);
            } else {
                // Schedule a trailing edge sync
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    syncToBrain(localValue);
                }, delay - timeSinceLastSync);
            }
        } else {
            // Standard Debounce
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                syncToBrain(localValue);
            }, delay);
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [localValue, delay, options.mode, syncToBrain]);

    return [localValue, setLocalValue] as const;
}

export const useNodeDebounce = useNodeUpdate;
