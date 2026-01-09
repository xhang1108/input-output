'use client';

import { Position, useReactFlow } from '@xyflow/react';
import { useState, memo, useCallback } from 'react';
import { Sliders } from 'lucide-react';
import { NodeShell } from './NodeShell';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';

interface NodeSliderProps {
    id: string;
    data: {
        label?: string;
        value?: number;
        min?: number;
        max?: number;
        step?: number;
        muted?: boolean;
    };
}

export const NodeSlider = memo(({ id, data, selected }: NodeSliderProps & { selected?: boolean }) => {
    const { updateNodeData } = useReactFlow();
    const { triggerLogicUpdate } = useAppStore();

    // Internal state for smooth dragging, synced to node data
    const [localValue, setLocalValue] = useState(data.value ?? 50);

    const min = data.min ?? 0;
    const max = data.max ?? 100;
    const step = data.step ?? 1;
    const isMuted = !!data.muted;

    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = parseFloat(e.target.value);
        setLocalValue(newVal);

        updateNodeData(id, { value: newVal });

        // Real-time engine update
        triggerLogicUpdate();
    }, [id, updateNodeData, triggerLogicUpdate]);

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-indigo-500 rounded-xl p-4 min-w-[160px] hover:border-indigo-400 ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <Sliders className="w-3 h-3 text-indigo-500" />
                    <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                        {data.label || 'Slider'}
                    </div>
                </div>
                <div className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    {localValue}
                </div>
            </div>

            <div className="px-1">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localValue}
                    onChange={onChange}
                    className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-500 nodrag"
                />
                <div className="flex justify-between mt-1 px-0.5">
                    <span className="text-[8px] text-zinc-400 font-mono">{min}</span>
                    <span className="text-[8px] text-zinc-400 font-mono">{max}</span>
                </div>
            </div>

            <SourceHandle
                position={Position.Right}
                id="output"
                color="indigo"
            />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data.value === next.data.value &&
    prev.data.muted === next.data.muted &&
    prev.data.min === next.data.min &&
    prev.data.max === next.data.max
));
