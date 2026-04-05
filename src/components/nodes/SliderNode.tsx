import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow, useStore, ReactFlowState } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { Settings2 } from 'lucide-react';
import { useNodeUpdate } from './hooks/useNodeDebounce';

export const SliderNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

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
    }, [min, max, step]);

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

    // [UI Fix] Local string state for partial input (e.g. typing "-" or ".")
    const [inputString, setInputString] = useState<string>(sanitizedInitialValue.toString());
    const isEditingInput = useRef(false);

    const [showSettings, setShowSettings] = useState(false);
    const isInteracting = useRef(false);

    const { updateNodeData } = useReactFlow();

    // Sync input string with local value when it changes from outside (drag/keyboard/brain)
    useEffect(() => {
        if (!isEditingInput.current) {
            setInputString(localValue.toString());
        }
    }, [localValue]);

    const selectedCount = useStore((s: ReactFlowState) => s.nodes.filter((n) => n.selected).length);

    // Node-level keyboard control: Adjust value when node is selected
    useEffect(() => {
        if (!props.selected || selectedCount > 1) return;

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input or textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                e.stopPropagation();
                setLocalValue(prev => quantize(prev - step));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                e.stopPropagation();
                setLocalValue(prev => quantize(prev + step));
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
    }, [props.selected, selectedCount, min, max, step, setLocalValue, quantize]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const valStr = e.target.value;
        setInputString(valStr);

        // Allow partial strings like "-", ".", "-." etc. in the UI
        // But only update the numeric state if it's a real number
        const valNum = parseFloat(valStr);
        if (!isNaN(valNum) && valStr !== '-' && valStr !== '+' && valStr !== '.') {
            setLocalValue(quantize(valNum));
        }
    }, [setLocalValue, quantize]);

    const handleBlur = useCallback(() => {
        isEditingInput.current = false;
        // Snap back to a valid, quantized string
        setInputString(localValue.toString());
    }, [localValue]);

    const handleFocus = useCallback(() => {
        isEditingInput.current = true;
    }, []);

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
                    <input
                        type="text"
                        inputMode="decimal"
                        value={inputString}
                        onChange={handleChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="nodrag text-lg font-mono font-bold bg-transparent border-none outline-none text-right w-14 focus:text-cyan-400 transition-colors"
                        style={{ color: 'var(--color-scalar)' }}
                    />
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

