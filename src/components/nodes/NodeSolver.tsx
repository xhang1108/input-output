'use client';

import { Handle, Position, useReactFlow } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { Sigma } from 'lucide-react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';
import { pullValue } from '@/engine/Brain';
import { useMuteLine, MuteLine } from './MuteVisual';

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
    const [solution, setSolution] = useState<number | string>('?');
    const [error, setError] = useState<string | null>(null);

    const isMuted = !!data.muted;
    const { containerRef, inputARef, outputRef, lineCoords } = useMuteLine(isMuted, [targetVar, selected]);

    // Unified Pull Logic
    useEffect(() => {
        const nodes = getNodes();
        const edges = getEdges();

        try {
            const pullResult = pullValue(id, nodes, edges);
            // We store the number for formatting, but Brain.ts might give a non-number in some edge cases
            setSolution(pullResult.val);
            setError(null);

            // If the solved value differs from current data, update it
            if (pullResult.val !== data.value) {
                updateNodeData(id, { value: pullResult.val });
            }
        } catch (e: any) {
            setError(e.message || 'Error');
            setSolution('Error');
        }
    }, [logicVersion, id, getNodes, getEdges, updateNodeData, data.value]);

    return (
        <NodeShell
            ref={containerRef}
            selected={selected}
            className={`bg-zinc-900 border-2 border-indigo-500 rounded-xl p-4 shadow-lg min-w-[200px] transition-all ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            {/* Inputs */}
            <TargetHandle
                ref={inputARef}
                nodeId={id}
                position={Position.Left}
                id="inputA"
            />

            <div className="flex items-center gap-2 mb-3 border-b border-zinc-800 pb-2">
                <Sigma className="w-5 h-5 text-indigo-500" />
                <span className="text-zinc-200 font-bold text-sm">Solver</span>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500">Solve for:</label>
                    <input
                        type="text"
                        value={targetVar}
                        onChange={(e) => {
                            setTargetVar(e.target.value);
                            updateNodeData(id, { targetVar: e.target.value });
                        }}
                        className="w-10 bg-zinc-800 border border-zinc-700 rounded px-1 text-xs text-center text-white focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div className="bg-zinc-950 rounded p-2 text-center">
                    <div className="text-[10px] text-zinc-500 mb-1">SOLUTION</div>
                    <div className="text-xl font-mono text-indigo-400 font-bold tabular-nums">
                        {typeof solution === 'number'
                            ? solution.toLocaleString('en-US', { maximumFractionDigits: 10 })
                            : solution}
                    </div>
                </div>
            </div>

            {/* Output (The solved value) */}
            <SourceHandle
                ref={outputRef}
                position={Position.Right}
                color="indigo"
            />

            {/* Muted Pass-through Visual */}
            <MuteLine coords={lineCoords} color="#6366f1" />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));
