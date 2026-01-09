'use client';

import { Position, type NodeProps, useStoreApi, useReactFlow } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { pullValue, FALLBACK_PAYLOAD } from '../../engine/Brain';
import { useAppStore } from '@/store/useAppStore';
import { useNodeResult } from './useNodeResult';
import { ResultPreview } from './ResultPreview';

export const NodeNumber = memo(({ id, data, selected }: NodeProps) => {
    const { result, error } = useNodeResult(id);
    const isMatrix = result && (result.isMatrix || Array.isArray(result));
    const isError = !!error || isMatrix;

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

                <ResultPreview
                    result={isMatrix ? "TYPE ERR" : result}
                    error={error}
                    className={`text-3xl font-bold ${isError ? 'text-red-500' : ''}`}
                />

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
