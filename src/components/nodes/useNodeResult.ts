'use client';

import { useState, useEffect } from 'react';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { pullValue } from '@/engine/Brain';
import { useAppStore } from '@/store/useAppStore';

/**
 * Atomic hook for nodes to subscribe to the global calculation engine
 * and pull their own results locally for previewing.
 */
export const useNodeResult = (nodeId: string) => {
    const { getEdges } = useReactFlow();
    const { logicVersion } = useAppStore();
    const store = useStoreApi();

    const [payload, setPayload] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const edges = getEdges();
        try {
            const nodeLookup = (store.getState() as any).nodeLookup;
            const pullResult = pullValue(nodeId, nodeLookup, edges);

            setPayload(pullResult);
            setError(null);
        } catch (e: any) {
            setError(e.message || 'Error');
        }
    }, [logicVersion, nodeId, getEdges, store]);

    return {
        result: payload?.val,
        formula: payload?.formula,
        display: payload?.display,
        rawPayload: payload,
        error
    };
};
