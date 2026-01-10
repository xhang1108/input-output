'use client';

import { Position, type NodeProps, useStoreApi, useReactFlow } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { pullValue, FALLBACK_PAYLOAD } from '../../engine/Brain';
import { useAppStore } from '@/store/useAppStore';
import { GridTable } from '../visuals/GridTable';
import { useNodeResult } from './useNodeResult';
import { NodeHeader } from './NodeHeader';

export const NodeMatrix = memo(({ id, data, selected }: NodeProps) => {
    const { result, error } = useNodeResult(id);
    const isMatrix = result && (result.isMatrix || Array.isArray(result));
    const dims = isMatrix ? (Array.isArray(result?.[0]) ? `${result.length}×${result[0].length}` : `[${result.length}]`) : '1×1';

    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-indigo-500 rounded-xl p-4 min-w-[200px] hover:border-indigo-400 relative ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputA"
            />

            <div className="flex flex-col items-center gap-2 w-full">
                <NodeHeader
                    label="Matrix"
                    badge={dims}
                />

                {(isMatrix || typeof result === 'number') ? (
                    <GridTable data={isMatrix ? result : [[result]]} />
                ) : (
                    <div className="text-zinc-300 py-4 italic text-xs">
                        {error ? 'Error' : 'No Data'}
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
