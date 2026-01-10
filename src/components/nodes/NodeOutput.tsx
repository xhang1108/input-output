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
import { NodeHeader } from './NodeHeader';

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
    // Reliable matrix check for both Arrays and MathJS Matrix objects (Live & Serialized)
    const isMatrix = result && (
        Array.isArray(result) ||
        result?.isMatrix === true ||
        result?.type === 'Matrix' ||
        (typeof result === 'object' && (
            typeof result.toArray === 'function' ||
            result.mathjs === 'DenseMatrix' ||
            Array.isArray(result.data) ||
            Array.isArray(result._data)
        ))
    );

    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-green-500 rounded-xl p-3 min-w-[140px] hover:border-green-400 relative flex flex-col ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputA"
                style={{ top: '50%' }}
            />

            {/* Header: Inset Style */}
            <NodeHeader
                label="Result"
                className="mb-2 w-full"
                textColor="text-green-600"
            />

            {/* Content Body */}
            <div className="flex flex-col items-center gap-3 w-full">
                {/* Result Box: Mimics an input field / grid cell */}
                <div className="w-full h-12 flex items-center justify-center bg-zinc-50 border border-zinc-200 rounded-lg shadow-sm">
                    <ResultPreview
                        result={result}
                        error={error}
                        precision={14}
                        className="border-t-0 mt-0 pt-0 text-xl font-bold"
                    />
                </div>

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
