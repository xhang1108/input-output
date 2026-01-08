'use client';

import { memo, useState, useEffect } from 'react';
import { Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';
import { pullValue } from '@/engine/Brain';
import { NodeShell } from './NodeShell';
import { useMuteLine, MuteLine } from './MuteVisual';

export const NodeSwitch = memo(({ id, data, selected, isConnectable }: NodeProps) => {
    const { getNodes, getEdges } = useReactFlow();
    const { triggerLogicUpdate, logicVersion } = useAppStore();
    const [result, setResult] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isMuted = !!data.muted;

    // In NodeSwitch, mute pass-through is ifFalse -> Output
    const { containerRef, inputARef: inputFalseRef, outputRef, lineCoords } = useMuteLine(isMuted, [selected]);

    // Unified Pull Logic for Preview
    useEffect(() => {
        const nodes = getNodes();
        const edges = getEdges();
        try {
            const pullResult = pullValue(id, nodes, edges);
            setResult(pullResult.val);
            setError(null);
        } catch (e: any) {
            setError(e.message || 'Error');
        }
    }, [logicVersion, id, getNodes, getEdges]);

    // Check condition value (pulled from inputA in Brain.ts)
    // We'll need to know which branch is active for the LED
    // Brain.ts will handle the actual logic, but we can peek here if we want.
    // However, it's better to just show the final result.

    return (
        <NodeShell
            ref={containerRef}
            selected={selected}
            className={`bg-zinc-100 border-2 border-indigo-500 rounded-xl shadow-lg min-w-[160px] hover:border-indigo-400 transition-all ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            {/* Header */}
            <div className="bg-indigo-50 px-3 py-1.5 border-b border-indigo-100 flex items-center justify-between rounded-t-[10px]">
                <div className="text-indigo-600 font-bold text-[10px] uppercase tracking-wider">SWITCH / IF</div>
                <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : result !== null ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-300'}`} />
            </div>

            {/* Inputs */}
            <div className="p-3 space-y-3 relative">
                <div className="flex flex-col gap-3">
                    {/* Condition Input */}
                    <div className="flex items-center justify-between relative h-5">
                        <TargetHandle
                            nodeId={id}
                            position={Position.Left}
                            id="condition"
                            isConnectable={isConnectable}
                            className="!-left-[17px] !bg-indigo-400"
                        />
                        <span className="text-indigo-600 text-[10px] ml-2 font-bold uppercase">Condition</span>
                    </div>

                    {/* True Branch */}
                    <div className="flex items-center justify-between relative h-5">
                        <TargetHandle
                            nodeId={id}
                            position={Position.Left}
                            id="ifTrue"
                            isConnectable={isConnectable}
                            className="!-left-[17px] !bg-green-400"
                        />
                        <span className="text-green-600 text-[10px] ml-2 font-bold uppercase">If True</span>
                    </div>

                    {/* False Branch */}
                    <div className="flex items-center justify-between relative h-5">
                        <TargetHandle
                            ref={inputFalseRef}
                            nodeId={id}
                            position={Position.Left}
                            id="ifFalse"
                            isConnectable={isConnectable}
                            className="!-left-[17px] !bg-red-400"
                        />
                        <span className="text-red-600 text-[10px] ml-2 font-bold uppercase">If False</span>
                    </div>
                </div>
            </div>

            {/* Output Area */}
            <div className="bg-zinc-50 p-2 flex items-center justify-end relative h-8 rounded-b-[10px] border-t border-zinc-100">
                <span className="font-mono text-sm mr-2 font-bold text-zinc-600 truncate max-w-[100px]">
                    {error ? 'Error' : result !== null ?
                        result.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}
                </span>
                <SourceHandle
                    ref={outputRef}
                    position={Position.Right}
                    id="output"
                    isConnectable={isConnectable}
                    className="!-right-[7px] !bg-indigo-500 !border-indigo-500"
                />
            </div>

            {/* Muted Pass-through Visual (IfFalse -> Output) */}
            <MuteLine coords={lineCoords} color="#6366f1" />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));

NodeSwitch.displayName = 'NodeSwitch';
