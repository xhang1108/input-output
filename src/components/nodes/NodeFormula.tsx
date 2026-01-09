'use client';

import { Position, type NodeProps, useStoreApi, useReactFlow } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { pullValue, FALLBACK_PAYLOAD } from '../../engine/Brain';
import { useAppStore } from '@/store/useAppStore';

export const NodeFormula = memo(({ id, data, selected }: NodeProps) => {
    const { getEdges } = useReactFlow();
    const { logicVersion } = useAppStore();
    const [formula, setFormula] = useState<string>('');
    const [valuePreview, setValuePreview] = useState<string>('');

    const store = useStoreApi();

    useEffect(() => {
        const calculate = () => {
            const nodeLookup = store.getState().nodeLookup;
            const edges = getEdges();

            try {
                const inputEdge = edges.find(e => e.target === id && e.targetHandle === 'inputA');
                // Force NO evaluation? No, we need evaluation for the preview.
                // Pull Value will give us 'display' (Equation) and 'val' (Result)
                const payload = inputEdge
                    ? pullValue(inputEdge.source, nodeLookup, edges, new Set())
                    : FALLBACK_PAYLOAD;

                setFormula(payload.display); // "x + 5"

                // Format Preview
                const val = payload.val;
                if (val && (val.isMatrix || Array.isArray(val))) {
                    setValuePreview("Matrix");
                } else {
                    setValuePreview(String(val ?? '—'));
                }

            } catch (e) {
                setFormula("Error");
            }
        };

        calculate();
    }, [logicVersion, id, getEdges, store]);

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
                    <span className="text-purple-500">= {valuePreview}</span>
                </div>

                <div className="w-full text-lg font-mono text-zinc-800 bg-zinc-50 p-2 rounded border border-zinc-200 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-zinc-300">
                    {formula || '...'}
                </div>
            </div>
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));
