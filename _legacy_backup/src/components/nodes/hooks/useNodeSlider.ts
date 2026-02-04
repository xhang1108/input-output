'use client';

import { useState, useCallback, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAppStore } from '@/store/useAppStore';

export function useNodeSlider(id: string, initialValue: number) {
    const { updateNodeData } = useReactFlow();
    const { triggerLogicUpdate } = useAppStore();

    // Internal state for smooth dragging
    const [localValue, setLocalValue] = useState(initialValue);

    // Only update UI state while dragging
    const onSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(parseFloat(e.target.value));
    }, []);

    // Only trigger engine update when user releases the handle
    const onSliderCommit = useCallback(() => {
        updateNodeData(id, { value: localValue });
        triggerLogicUpdate();
    }, [id, localValue, updateNodeData, triggerLogicUpdate]);

    return {
        localValue,
        setLocalValue,
        onSliderChange,
        onSliderCommit,
    };
}
