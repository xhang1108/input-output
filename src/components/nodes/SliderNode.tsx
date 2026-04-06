import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { Settings2 } from 'lucide-react';
import { useNodeUpdate } from './hooks/useNodeDebounce';
import { NumericInput } from '../common/NumericInput';

export const SliderNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const { updateNodeData } = useReactFlow();

    const min = typeof data.min === 'number' ? data.min : 0;
    const max = typeof data.max === 'number' ? data.max : 100;
    const step = typeof data.step === 'number' ? data.step : 1;

    /**
     * Quantizes a value to the nearest step and fixes floating-point precision issues
     * (e.g. 0.1 + 0.2 -> 0.3 instead of 0.30000000000000004).
     */
    const quantize = useCallback((val: number) => {
        const steps = Math.round((val - min) / step);
        const quantized = steps * step + min;
        const stepStr = step.toString();
        const precision = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
        return parseFloat(quantized.toFixed(precision));
    }, [min, step]);

    // Pulse Fix: Quantize initial value immediately to handle existing precision errors in IOGL files
    const sanitizedInitialValue = quantize(Number(PayloadUtils.unwrap(data.value)) || 0);

    // Internal state for immediate UI feedback (Snappy UX)
    // Synchronizes with Brain at 30fps during drag (Throttle Mode)
    const [localValue, setLocalValue] = useNodeUpdate<number>(
        id,
        sanitizedInitialValue,
        (val: number) => ({ value: val }),
        33.3, // ~30fps
        { mode: 'throttle' }
    );

    const [showSettings, setShowSettings] = useState(false);
    const isInteracting = useRef(false);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(quantize(Number(e.target.value)));
    }, [setLocalValue, quantize]);

    const handleInputChange = useCallback((val: number) => {
        setLocalValue(quantize(val));
    }, [setLocalValue, quantize]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-3 p-1 w-full">
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
                    <div className="flex-1 min-w-0">
                        <NumericInput
                            value={localValue}
                            onChange={handleInputChange}
                            hideLabel={true}
                            inputClassName="text-sm font-bold text-zinc-100 h-8"
                        />
                    </div>
                </div>

                {showSettings && (
                    <div className="flex flex-col gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-3 gap-2">
                            <NumericInput 
                                label="Min"
                                value={min}
                                onChange={(val) => updateNodeData(id, { min: val })}
                                inputClassName="h-7"
                            />
                            <NumericInput 
                                label="Max"
                                value={max}
                                onChange={(val) => updateNodeData(id, { max: val })}
                                inputClassName="h-7"
                            />
                            <NumericInput 
                                label="Step"
                                value={step}
                                onChange={(val) => updateNodeData(id, { step: val })}
                                inputClassName="h-7"
                            />
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
                        onKeyDown={(e) => e.stopPropagation()}
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

