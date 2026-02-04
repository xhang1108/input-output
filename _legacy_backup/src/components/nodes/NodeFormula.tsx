'use client';

import { Position, type NodeProps, useStoreApi, useReactFlow } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { pullValue, FALLBACK_PAYLOAD } from '../../engine/Brain';
import { useAppStore } from '@/store/useAppStore';
import { useNodeResult } from './useNodeResult';
import { ResultPreview } from './ResultPreview';
import { NodeHeader } from './NodeHeader';

export const NodeFormula = memo(({ id, data, selected }: NodeProps) => {
    const { result, error, display } = useNodeResult(id);
    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-purple-500 rounded-xl min-w-[200px] min-h-[120px] hover:border-purple-400 relative flex flex-col ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputA"
                style={{ top: '50%' }}
            />

            {/* Header */}
            <NodeHeader
                label="Formula View"
                statusIndicator={error ? 'error' : result !== null ? 'success' : 'neutral'}
                className="bg-purple-50 px-4 py-2 border-b border-purple-100 rounded-t-[10px] mb-0 w-full"
                textColor="text-purple-600"
            />

            <div className="p-4 flex flex-col items-start gap-1 w-full relative">
                <div className="flex justify-end w-full mb-1">
                    <div className="flex items-center gap-1">
                        <span className="text-purple-500 font-bold">=</span>
                        <ResultPreview result={result} error={error} className="border-t-0 mt-0 pt-0 text-purple-600 font-bold" />
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
