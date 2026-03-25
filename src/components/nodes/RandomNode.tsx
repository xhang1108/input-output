
import React, { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { NodeOpSelect } from './NodeOpSelect';

export const RandomNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const { updateNodeData } = useReactFlow();


    const mode = (data.mode as string) || 'scalar';
    const distribution = (data.distribution as string) || 'Uniform';
    const isFloat = data.isFloat !== false;

    // Helper to safely extract numbers from data (prevents {} errors)
    const getVal = (val: any, def: number) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return parseFloat(val) || def;
        return def;
    };

    const handleChange = useCallback((key: string, value: unknown) => {
        updateNodeData(id, { [key]: value });
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { [key]: value } }
        });
    }, [id, updateNodeData, brain]);


    const handleRegenerate = () => {
        // We use seed to trigger evaluation instead of trigger timestamp for consistency with engine
        handleChange('seed', Date.now());
    };


    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 min-w-[170px] h-[335px]">
                {/* Distribution Selector */}
                <div className="flex flex-col">
                    <NodeOpSelect
                        nodeId={id}
                        defId="IN-10"
                        paramId="distribution"
                        data={data}
                        label="Distribution"
                    />
                </div>

                {/* Shape Selector */}
                <div className="flex flex-col border-t border-zinc-800/30 pt-1">
                    <NodeOpSelect
                        nodeId={id}
                        defId="IN-10"
                        paramId="mode"
                        data={data}
                        label="Output Mode"
                    />
                </div>

                {/* Distribution Parameters Container (Stable Height) */}
                <div className="h-[84px]">
                    <div className="flex flex-col gap-2 bg-zinc-900/30 p-2 rounded-md border border-zinc-700/30 h-full">
                        {distribution === 'Uniform' && (
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-zinc-500 uppercase font-black">Min</label>
                                    <input
                                        type="number"
                                        className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-focus/50 transition-colors w-full"
                                        value={getVal(data.min, 0)}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => handleChange('min', parseFloat(e.target.value))}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        step="1"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-zinc-500 uppercase font-black">Max</label>
                                    <input
                                        type="number"
                                        className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-focus/50 transition-colors w-full"
                                        value={getVal(data.max, 1)}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => handleChange('max', parseFloat(e.target.value))}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        step="1"
                                    />
                                </div>
                            </div>
                        )}

                        {distribution === 'Normal' && (
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-zinc-500 uppercase font-black">Mean (μ)</label>
                                    <input
                                        type="number"
                                        className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-focus/50 transition-colors w-full"
                                        value={getVal(data.mean, 0)}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => handleChange('mean', parseFloat(e.target.value))}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        step="1"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-zinc-500 uppercase font-black">StdDev (σ)</label>
                                    <input
                                        type="number"
                                        className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-focus/50 transition-colors w-full"
                                        value={getVal(data.stdDev, 1)}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => handleChange('stdDev', parseFloat(e.target.value))}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        min={0}
                                        step="1"
                                    />
                                </div>
                            </div>
                        )}

                        {(distribution === 'Poisson' || distribution === 'Exponential') && (
                            <div className="flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                                <label className="text-[9px] text-zinc-500 uppercase font-black">Lambda (λ)</label>
                                <input
                                    type="number"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-focus/50 transition-colors"
                                    value={getVal(data.lambda, 1)}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleChange('lambda', parseFloat(e.target.value))}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    min="0"
                                    step="1"
                                />
                            </div>
                        )}

                        {/* Float Toggle (Always rendered but hidden for Poisson to keep height stable) */}
                        <div className={`flex gap-2 items-center mt-auto ${distribution === 'Poisson' ? 'invisible pointer-events-none' : ''}`}>
                            <input
                                type="checkbox"
                                className="cursor-pointer"
                                checked={isFloat}
                                onChange={(e) => handleChange('isFloat', e.target.checked)}
                                onPointerDown={(e) => e.stopPropagation()}
                                id={`float-toggle-${id}`}
                            />
                            <label htmlFor={`float-toggle-${id}`} className="text-[10px] text-zinc-400 font-mono cursor-pointer select-none">
                                Floating Point
                            </label>
                        </div>
                    </div>
                </div>

                {/* Shape Settings Container (Stable Height) */}
                <div className="h-[60px]">
                    {mode === 'vector' && (
                        <div className="flex flex-col gap-1 bg-zinc-900/50 p-2 rounded-md border border-zinc-700/50 animate-in fade-in slide-in-from-top-1 duration-200 h-full">
                            <label className="text-[9px] text-zinc-500 uppercase font-black">Length</label>
                            <input
                                type="number"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-focus/50 transition-colors"
                                value={getVal(data.length, 100)}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleChange('length', parseInt(e.target.value))}
                                onPointerDown={(e) => e.stopPropagation()}
                                min={1}
                                step="1"
                            />
                        </div>
                    )}

                    {mode === 'matrix' && (
                        <div className="grid grid-cols-2 gap-2 bg-zinc-900/50 p-2 rounded-md border border-zinc-700/50 animate-in fade-in slide-in-from-top-1 duration-200 h-full">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-zinc-500 uppercase font-black">Rows</label>
                                <input
                                    type="number"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-focus/50 transition-colors"
                                    value={getVal(data.rows, 3)}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleChange('rows', parseInt(e.target.value))}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    min={1}
                                    step="1"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-zinc-500 uppercase font-black">Cols</label>
                                <input
                                    type="number"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-focus/50 transition-colors"
                                    value={getVal(data.cols, 3)}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleChange('cols', parseInt(e.target.value))}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    min={1}
                                    step="1"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Regenerate Button */}
                <button
                    className="mt-auto mb-1 bg-zinc-100/10 hover:bg-zinc-100/20 active:bg-zinc-100/5 text-[10px] text-zinc-100 py-2 rounded border border-white/10 transition-all font-bold uppercase tracking-wider shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    onClick={handleRegenerate}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                </button>
            </div>
        </BaseNode>
    );
});

RandomNode.displayName = 'RandomNode';
