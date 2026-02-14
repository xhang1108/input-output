import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const SliderNode = memo((props: NodeProps) => {
    const { id, data } = props;

    // Internal state for immediate UI feedback
    // Unwrap payload to get numeric value
    const initialValue = Number(PayloadUtils.unwrap(data.value)) || 0;
    const [localValue, setLocalValue] = useState(initialValue);

    const min = typeof data.min === 'number' ? data.min : 0;
    const max = typeof data.max === 'number' ? data.max : 100;
    const step = typeof data.step === 'number' ? data.step : 1;

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            setLocalValue(val);

            // Send to Brain. Brain handles debouncing the heavy calculation.
            Brain.getInstance().applyTransaction({
                type: 'UPDATE_VALUE',
                payload: { id, value: val }
            });
        }
    }, [id]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-3 p-1 w-(--node-width-min)">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Slider</label>
                    <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded border border-zinc-800"
                        style={{ background: 'var(--node-bg)', color: 'var(--color-unit)' }}
                    >
                        {localValue}
                    </span>
                </div>

                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localValue}
                    onChange={handleChange}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="nodrag w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                />

                <div className="flex justify-between text-[8px] text-zinc-600 font-medium">
                    <span>{min}</span>
                    <span>{max}</span>
                </div>
            </div>
        </BaseNode>
    );
});

SliderNode.displayName = 'SliderNode';
