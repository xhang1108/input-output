'use client';

import { Position, type NodeProps, useStoreApi, useReactFlow } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { pullValue, FALLBACK_PAYLOAD } from '../../engine/Brain';
import { useAppStore } from '@/store/useAppStore';
import { useNodeResult } from './useNodeResult';
import { ResultPreview } from './ResultPreview';

export const NodeFormula = memo(({ id, data, selected }: NodeProps) => {
    const { result, error, display } = useNodeResult(id);
    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-purple-500 rounded-xl p-4 min-w-[200px] hover:border-purple-400 relative ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputA"
            />

            <div className="flex flex-col items-start gap-1 w-full">
                <div className="flex justify-between w-full text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    <span>Formula</span>
                    <div className="flex items-center gap-1">
                        <span className="text-purple-500">=</span>
                        <ResultPreview result={result} error={error} className="border-t-0 mt-0 pt-0 text-purple-500 font-bold" />
                    </div>
                </div>

                <div className="w-full text-lg font-mono text-zinc-800 bg-zinc-50 p-2 rounded border border-zinc-200 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-zinc-300">
                    {display || '...'}
                </div>
            </div>
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));
