import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { Settings2 } from 'lucide-react';

export const SliderNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

    // Internal state for immediate UI feedback
    // Unwrap payload to get numeric value
    const initialValue = Number(PayloadUtils.unwrap(data.value)) || 0;
    const [localValue, setLocalValue] = useState(initialValue);

    const [showSettings, setShowSettings] = useState(false);
    const isInteracting = useRef(false);

    // Sync internal state with external value changes (e.g. from N Panel)
    useEffect(() => {
        if (!isInteracting.current) {
            setLocalValue(initialValue);
        }
    }, [initialValue]);

    const { updateNodeData } = useReactFlow();

    const min = typeof data.min === 'number' ? data.min : 0;
    const max = typeof data.max === 'number' ? data.max : 100;
    const step = typeof data.step === 'number' ? data.step : 1;

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            setLocalValue(val);

            // Send to Brain. Brain handles debouncing the heavy calculation.
            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id, data: { value: val } }
            });
        }
    }, [id, brain]);

    const handleSettingChange = (key: string, value: string) => {
        const numVal = parseFloat(value);
        if (!isNaN(numVal)) {
            updateNodeData(id, { [key]: numVal });
            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id, data: { [key]: numVal } }
            });
        }
    };

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-3 p-1 w-(--node-width-min)">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Slider</label>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-1 rounded-sm hover:bg-zinc-800 transition-colors ${showSettings ? 'text-cyan-400' : 'text-zinc-600'}`}
                        >
                            <Settings2 size={12} />
                        </button>
                    </div>
                    <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded-sm border border-zinc-800"
                        style={{ background: 'var(--node-bg)', color: 'var(--color-scalar)' }}
                    >
                        {localValue}
                    </span>
                </div>

                {showSettings && (
                    <div className="flex flex-col gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-zinc-500 uppercase font-bold">Min</span>
                                <input
                                    type="number"
                                    value={min}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleSettingChange('min', e.target.value)}
                                    className="bg-zinc-950 border border-zinc-800 rounded-sm px-1 py-0.5 text-[10px] text-zinc-300 outline-none focus:border-cyan-500/50"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-zinc-500 uppercase font-bold">Max</span>
                                <input
                                    type="number"
                                    value={max}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleSettingChange('max', e.target.value)}
                                    className="bg-zinc-950 border border-zinc-800 rounded-sm px-1 py-0.5 text-[10px] text-zinc-300 outline-none focus:border-cyan-500/50"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-zinc-500 uppercase font-bold">Step</span>
                                <input
                                    type="number"
                                    value={step}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleSettingChange('step', e.target.value)}
                                    className="bg-zinc-950 border border-zinc-800 rounded-sm px-1 py-0.5 text-[10px] text-zinc-300 outline-none focus:border-cyan-500/50"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div 
                    className="relative group"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={localValue}
                        onChange={handleChange}
                        onPointerDown={(e) => {
                            isInteracting.current = true;
                            e.stopPropagation();
                        }}
                        onMouseDown={(e) => {
                            isInteracting.current = true;
                            e.stopPropagation();
                        }}
                        onMouseUp={() => {
                            isInteracting.current = false;
                        }}
                        onPointerUp={() => {
                            isInteracting.current = false;
                        }}
                        className="nodrag w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                    />
                </div>

                <div className="flex justify-between text-[8px] text-zinc-600 font-medium px-0.5">
                    <span>{min}</span>
                    <span>{max}</span>
                </div>
            </div>
        </BaseNode>
    );

});

SliderNode.displayName = 'SliderNode';
