'use client';

import { Position, type NodeProps, useStoreApi, useReactFlow } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { pullValue, FALLBACK_PAYLOAD } from '../../engine/Brain';
import { useAppStore } from '@/store/useAppStore';
import { MatrixTable } from '../visuals/MatrixTable';
import { checkIsMatrix, normalizeMatrixData } from '@/utils/resultUtils';

export const NodeMatrix = memo(({ id, data, selected }: NodeProps) => {
    const { getEdges } = useReactFlow();
    const { logicVersion } = useAppStore();
    const [matrixData, setMatrixData] = useState<any>(null);
    const [dims, setDims] = useState<string>('');

    const store = useStoreApi();

    useEffect(() => {
        const calculate = () => {
            const nodeLookup = store.getState().nodeLookup;
            const edges = getEdges();

            try {
                // 1. Pull
                const inputEdge = edges.find(e => e.target === id && e.targetHandle === 'inputA');
                const payload = inputEdge
                    ? pullValue(inputEdge.source, nodeLookup, edges, new Set())
                    : FALLBACK_PAYLOAD;

                const val = payload.val;

                // 2. Format
                if (checkIsMatrix(val)) {
                    const raw = normalizeMatrixData(val);
                    setMatrixData(raw);

                    // Dims
                    if (Array.isArray(raw)) {
                        if (Array.isArray(raw?.[0])) {
                            setDims(`${raw.length}×${raw[0].length}`);
                        } else {
                            setDims(`[${raw.length}]`);
                        }
                    }
                } else if (typeof val === 'number') {
                    // Scalar treated as 1x1 matrix
                    setMatrixData([[val]]);
                    setDims('1×1');
                } else {
                    setMatrixData(null);
                    setDims('');
                }

            } catch (e) {
                setMatrixData(null);
            }
        };

        calculate();
    }, [logicVersion, id, getEdges, store]);

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
                <div className="flex justify-between w-full text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    <span>Matrix</span>
                    <span className="text-indigo-500">{dims}</span>
                </div>

                {matrixData ? (
                    <MatrixTable data={matrixData} />
                ) : (
                    <div className="text-zinc-300 py-4 italic text-xs">No Data</div>
                )}
            </div>
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));
