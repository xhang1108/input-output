
import React, { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { NodeOpSelect } from './NodeOpSelect';
import { NumericInput } from '../common/NumericInput';

export const RandomNode = memo((props: NodeProps) => {
    const { id, data, type } = props;
    const brain = useBrain();
    const { updateNodeData } = useReactFlow();

    // Mapping for UI logic (Backwards compatibility for legacy mode strings)
    const rawMode = (data.mode as string) || 'Uniform';
    const distribution = rawMode.includes(':') ? rawMode.split(':')[0] : rawMode;
    const isFloat = data.isFloat !== undefined ? !!data.isFloat : (rawMode.includes(':Float') || !rawMode.includes(':Int')); 

    const isUniform = distribution === 'Uniform';
    const isNormal = distribution === 'Normal';
    const isExponential = distribution === 'Exponential' || distribution === 'Exp';
    const isPoisson = distribution === 'Poisson';


    const handleChange = useCallback((key: string, value: unknown) => {
        updateNodeData(id, { [key]: value });
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { [key]: value } }
        });
    }, [id, updateNodeData, brain]);

    const handleFloatToggle = (checked: boolean) => {
        handleChange('isFloat', checked);
    };

    const handleRegenerate = () => {
        handleChange('seed', Date.now());
    };

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 min-w-[170px] h-[320px]">
                {/* Standardized Distribution Selector */}
                <NodeOpSelect 
                    nodeId={id} 
                    defId="IN-10" 
                    paramId="mode" 
                    data={{ ...data, mode: distribution }} 
                    label="Distribution"
                />

                {/* Dimensions Grid */}
                <div className="grid grid-cols-2 gap-2 bg-zinc-900/30 p-2 rounded-xl border border-zinc-800/30">
                    <NumericInput 
                        label="Rows"
                        value={typeof data.rows === 'number' ? data.rows : 1}
                        onChange={(val) => handleChange('rows', Math.max(1, Math.floor(val)))}
                        inputClassName="h-7"
                    />
                    <NumericInput 
                        label="Cols"
                        value={typeof data.cols === 'number' ? data.cols : 1}
                        onChange={(val) => handleChange('cols', Math.max(1, Math.floor(val)))}
                        inputClassName="h-7"
                    />
                </div>

                {/* Distribution Parameters */}
                <div className="h-[105px]">
                    <div className="flex flex-col gap-2 bg-zinc-900/50 p-2 rounded-xl border border-zinc-700/50 h-full">
                        {(isUniform || isNormal) && (
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95 duration-200">
                                <NumericInput 
                                    label={isUniform ? 'Min' : 'Mean (μ)'}
                                    value={isUniform ? (typeof data.min === 'number' ? data.min : 0) : (typeof data.mean === 'number' ? data.mean : 0)}
                                    onChange={(val) => handleChange(isUniform ? 'min' : 'mean', val)}
                                />
                                <NumericInput 
                                    label={isUniform ? 'Max' : 'StdDev (σ)'}
                                    value={isUniform ? (typeof data.max === 'number' ? data.max : 1) : (typeof data.stdDev === 'number' ? data.stdDev : 1)}
                                    onChange={(val) => handleChange(isUniform ? 'max' : 'stdDev', isNormal ? Math.max(0, val) : val)}
                                />
                            </div>
                        )}

                        {(isPoisson || isExponential) && (
                            <div className="flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                                <NumericInput 
                                    label="Lambda (λ)"
                                    value={typeof data.lambda === 'number' ? data.lambda : 1}
                                    onChange={(val) => handleChange('lambda', Math.max(0, val))}
                                />
                            </div>
                        )}

                        {/* Float Toggle */}
                        <div className={`flex gap-2 items-center mt-auto ${isPoisson ? 'invisible pointer-events-none' : ''}`}>
                            <input
                                type="checkbox"
                                className="cursor-pointer"
                                checked={isFloat}
                                onChange={(e) => handleFloatToggle(e.target.checked)}
                                onPointerDown={(e) => e.stopPropagation()}
                                id={`float-toggle-${id}`}
                            />
                            <label htmlFor={`float-toggle-${id}`} className="text-[10px] text-zinc-400 font-mono cursor-pointer select-none">
                                Floating Point
                            </label>
                        </div>
                    </div>
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

