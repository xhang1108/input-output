'use client';

import { Position, type NodeProps, useReactFlow, useStoreApi } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { pullValue, FALLBACK_PAYLOAD } from '../../engine/Brain';
import { useAppStore } from '@/store/useAppStore';
import { MatrixTable } from '../visuals/MatrixTable';
import { formatValue, checkIsMatrix } from '@/utils/resultUtils';

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
    const outputData = data as NodeOutputData;
    const { updateNodeData } = useReactFlow();

    const { getNodes, getEdges } = useReactFlow();
    const { logicVersion } = useAppStore();
    const [pullResult, setPullResult] = useState<{ val: string; rawVal: any; formula: string; display: string } | null>(null);

    const store = useStoreApi();

    useEffect(() => {
        const calculate = () => {
            const nodeLookup = store.getState().nodeLookup;
            const edges = getEdges();

            let payload;
            try {
                // 1. Pull
                const inputEdge = edges.find(e => e.target === id && e.targetHandle === 'inputA');

                payload = inputEdge
                    ? pullValue(inputEdge.source, nodeLookup, edges, new Set())
                    : FALLBACK_PAYLOAD;

                // 2. Evaluate
                if (payload.formula === '0' && Object.keys(payload.scope).length === 0) {
                    setPullResult({ val: '0', rawVal: 0, formula: '0', display: '0' });
                    return;
                }

                // 3. Final Execution
                const finalVal = payload.val;

                setPullResult({
                    val: formatValue(finalVal),
                    rawVal: finalVal,
                    formula: payload.formula,
                    display: payload.display
                });

            } catch (e: any) {
                if (e.message && e.message.includes("Cycle")) {
                    setPullResult({ val: "Loop", rawVal: null, formula: "Cycle Detected", display: "Cycle" });
                } else {
                    setPullResult({ val: "Error", rawVal: null, formula: "Calculation Error", display: "Error" });
                }
            }
        };

        calculate();
    }, [logicVersion, id, getNodes, getEdges]);

    // Use the decoupled engine result
    let displayValue = '—';

    // --- Legacy Logic (Push) ---
    if (outputData.result !== undefined && outputData.result !== null) {
        displayValue = String(outputData.result);
    }

    // --- Hybrid Pull Override ---
    if (pullResult) {
        displayValue = pullResult.val;
    }

    const isMuted = !!data.muted;
    const isMatrix = pullResult?.rawVal && checkIsMatrix(pullResult.rawVal);

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

                <div className={`font-mono font-bold text-zinc-800 tabular-nums my-1 transition-all text-3xl`}>
                    {displayValue}
                </div>

                {/* Atomic Matrix View */}
                {isMatrix && (
                    <div className="w-full mt-2 border-t border-zinc-200 pt-3">
                        <div className="text-[9px] text-zinc-400 uppercase mb-2 font-bold flex justify-between">
                            <span>Matrix View</span>
                            <span className="text-indigo-500">Live</span>
                        </div>
                        <MatrixTable data={pullResult.rawVal} />
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
