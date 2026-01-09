'use client';

import { Position, type NodeProps, useStoreApi, useReactFlow } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { pullValue, FALLBACK_PAYLOAD } from '../../engine/Brain';
import { useAppStore } from '@/store/useAppStore';
import { checkIsMatrix, formatValue } from '@/utils/resultUtils';

export const NodeNumber = memo(({ id, data, selected }: NodeProps) => {
    const { getEdges } = useReactFlow();
    const { logicVersion } = useAppStore();
    const [displayValue, setDisplayValue] = useState<string>('—');
    const [isError, setIsError] = useState(false);

    const store = useStoreApi();

    useEffect(() => {
        const calculate = () => {
            const nodeLookup = store.getState().nodeLookup;
            const edges = getEdges();

            try {
                // 1. Pull payload
                const inputEdge = edges.find(e => e.target === id && e.targetHandle === 'inputA');
                const payload = inputEdge
                    ? pullValue(inputEdge.source, nodeLookup, edges, new Set())
                    : FALLBACK_PAYLOAD;

                const val = payload.val;

                // 2. Strict Type Check
                // If it's a Matrix or Array, this is the Wrong Node
                const isMatrix = checkIsMatrix(val);

                if (isMatrix) {
                    setDisplayValue("TYPE ERR");
                    setIsError(true);
                    return;
                }

                setIsError(false);

                // 3. Format Number
                setDisplayValue(formatValue(val));

            } catch (e) {
                setDisplayValue("ERR");
                setIsError(true);
            }
        };

        calculate();
    }, [logicVersion, id, getEdges, store]);

    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 ${isError ? 'border-red-500' : 'border-green-500'} rounded-xl p-4 min-w-[120px] hover:border-green-400 relative ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputA"
            />

            <div className="flex flex-col items-center gap-1">
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider w-full text-center">
                    Number
                </div>

                <div className={`font-mono font-bold text-zinc-800 tabular-nums my-1 text-3xl ${isError ? 'text-red-500' : ''}`}>
                    {displayValue}
                </div>

                {isError && (
                    <div className="text-[9px] text-red-500 font-bold uppercase">
                        Use Matrix Node
                    </div>
                )}
            </div>
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));
