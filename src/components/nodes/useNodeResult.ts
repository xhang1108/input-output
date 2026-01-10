'use client';

import { useState, useEffect } from 'react';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { pullValue, isNodeAlive } from '@/engine/Brain';
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
            const state = store.getState() as any;
            // React Flow v12 nodes can be accessed via 'nodes' array or internal 'nodeLookup' map
            const nodes = state.nodes || [];
            const nodeLookup = state.nodeLookup || new Map();
            const referenceNodes = nodeLookup.size > 0 ? nodeLookup : nodes;

            // Dead Code Elimination: Only calculate if alive (connected to sink)
            if (!isNodeAlive(nodeId, referenceNodes, edges)) {
                setPayload(null);
                setError(null);
                return;
            }

            const pullResult = pullValue(nodeId, referenceNodes, edges);

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
