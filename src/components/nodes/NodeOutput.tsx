'use client';

import { Position, type NodeProps, useReactFlow, useStoreApi } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { pullValue, FALLBACK_PAYLOAD } from '../../engine/Brain';
import { useAppStore } from '@/store/useAppStore';
import { GridTable } from '../visuals/GridTable';
import { useNodeResult } from './useNodeResult';
import { ResultPreview } from './ResultPreview';

interface NodeOutputData {
    value?: number;
    result?: number;
    error?: string;
    inheritedAST?: unknown;
    label?: string;
    displayMode?: 'auto' | 'value' | 'formula';
    [key: string]: unknown;
}

export const NodeOutput = memo(({ id, data, selected }: NodeProps) => {
    const { result, error, display, rawPayload } = useNodeResult(id);
    const isMatrix = result && (result.isMatrix || Array.isArray(result));

    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-green-500 rounded-xl p-4 min-w-[200px] hover:border-green-400 relative ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputA"
            />

            <div className="flex flex-col items-center gap-3">
                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider flex items-center justify-between w-full">
                    <span>Result</span>
                </div>

                <ResultPreview
                    result={result}
                    error={error}
                    precision={14}
                    className="border-t-0 mt-0 pt-0 text-3xl font-bold"
                />

                {/* Atomic Matrix View */}
                {isMatrix && (
                    <div className="w-full mt-2 border-t border-zinc-200 pt-3">
                        <div className="text-[9px] text-zinc-400 uppercase mb-2 font-bold flex justify-between">
                            <span>Matrix View</span>
                            <span className="text-indigo-500">Live</span>
                        </div>
                        <GridTable data={result} />
                    </div>
                )}
            </div>
        </NodeShell>
    );
}, (prev, next) => {
    return (
        prev.id === next.id &&
        prev.selected === next.selected &&
        prev.data === next.data
    );
});
