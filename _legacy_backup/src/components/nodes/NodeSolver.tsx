'use client';

import { Handle, Position, useReactFlow, useStoreApi } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { Sigma } from 'lucide-react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';
import { pullValue } from '@/engine/Brain';
import { useMuteLine, MuteLine } from './MuteVisual';
import { useNodeResult } from './useNodeResult';
import { ResultPreview } from './ResultPreview';
import { NodeHeader } from './NodeHeader';

interface NodeSolverProps {
    id: string;
    data: {
        label?: string;
        value?: number; // The solved value
        targetVar?: string; // The variable to solve for (e.g. 'x')
        inheritedAST?: any; // The LHS expression (e.g. 2x + 5)
        rhsValue?: number; // The RHS value (e.g. 15)
        muted?: boolean;
    };
}

export const NodeSolver = memo(({ id, data, selected }: NodeSolverProps & { selected?: boolean }) => {
    const { updateNodeData, getNodes, getEdges } = useReactFlow();
    const { triggerLogicUpdate, logicVersion } = useAppStore();
    const [targetVar, setTargetVar] = useState(data.targetVar || 'x');
    const { result, error } = useNodeResult(id);
    const isMuted = !!data.muted;

    // Use shared mute line logic
    const { containerRef, inputARef, outputRef, lineCoords } = useMuteLine(isMuted, [targetVar, selected]);

    // Sync result back to data if needed (Solver needs this for persistence of its "Solution")
    useEffect(() => {
        if (result !== null && result !== undefined && result !== data.value) {
            updateNodeData(id, { value: result });
        }
    }, [result, id, updateNodeData, data.value]);

    // Dynamic Handle Logic
    const edges = useReactFlow().getEdges();
    const myEdges = edges.filter(e => e.target === id);

    // Calculate how many handles to show
    // We always show input_0 (Eq).
    // If input_N is connected, we show input_{N+1}.
    // We scan indices to find the highest connected index.
    let maxIndex = 0;
    myEdges.forEach(e => {
        if (e.targetHandle && e.targetHandle.startsWith('input_')) {
            const idx = parseInt(e.targetHandle.split('_')[1]);
            if (!isNaN(idx)) maxIndex = Math.max(maxIndex, idx);
        }
        // Legacy support
        if (e.targetHandle === 'inputA') maxIndex = Math.max(maxIndex, 0);
        if (e.targetHandle === 'inputB') maxIndex = Math.max(maxIndex, 1);
    });

    // We show handles up to maxIndex + 1 (the next free slot)
    // But at least 2 handles (0: Eq, 1: Context)
    const handleCount = Math.max(maxIndex + 2, 2);
    const handles = Array.from({ length: handleCount }, (_, i) => i);

    return (
        <NodeShell
            ref={containerRef}
            selected={selected}
            className={`bg-zinc-900 border-2 border-indigo-500 rounded-xl min-w-[200px] p-3 flex flex-col transition-all duration-200 ${isMuted ? 'opacity-50 grayscale' : ''}`}
            style={{ minHeight: `${160 + handleCount * 45}px` }}
        >
            {/* Header: Inset Style */}
            <NodeHeader
                label="Equation Solver"
                icon={<Sigma className="w-4 h-4 text-indigo-400" />}
                textColor="text-zinc-300"
                className="mb-2 w-full"
            />

            {/* MOVED: Data / Result Block (Top Center) */}
            <div className="flex flex-col gap-2 relative bg-zinc-950/50 border border-zinc-800 rounded-lg p-3 mb-2">
                <div className="flex items-center justify-center gap-2">
                    <label className="text-xs text-zinc-500 font-medium">Solve for</label>
                    <input
                        type="text"
                        value={targetVar}
                        onChange={(e) => {
                            setTargetVar(e.target.value);
                            updateNodeData(id, { targetVar: e.target.value });
                        }}
                        className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-sm text-center text-white focus:outline-none focus:border-indigo-500 font-mono shadow-inner"
                    />
                </div>

                <div className="bg-zinc-950 rounded-lg p-1.5 flex justify-center border border-zinc-800 shadow-inner min-h-[40px] items-center">
                    <ResultPreview result={result} error={error} precision={10} className="border-0 m-0 p-0 text-lg font-bold" />
                </div>
            </div>

            {/* Dynamic Inputs */}
            {
                handles.map((idx) => {
                    // Shifted down to make room for the top data block
                    const top = 170 + (idx * 45);

                    return (
                        <div key={`input-${idx}`} className="absolute left-0 w-full" style={{ top: `${top}px` }}>
                            <TargetHandle
                                nodeId={id}
                                position={Position.Left}
                                id={`input_${idx}`}
                                className="bg-teal-500"
                                style={{ top: 0 }}
                            />
                        </div>
                    );
                })
            }

            {/* Spacer for handles */}
            <div style={{ height: `${handles.length * 45}px` }} />

            {/* Output (The solved value) */}
            <SourceHandle
                ref={outputRef}
                position={Position.Right}
                id="output"
                color="indigo"
            />

            {/* Muted Pass-through Visual */}
            <MuteLine coords={lineCoords} color="#6366f1" />
        </NodeShell >
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));
