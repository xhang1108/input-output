'use client';

import { Position, useReactFlow } from '@xyflow/react';
import { memo } from 'react';
import { Sliders } from 'lucide-react';
import { NodeShell } from './NodeShell';
import { SourceHandle } from '../handles/SourceHandle';
import { NodeHeader } from './NodeHeader';
import { useNodeSlider } from './hooks/useNodeSlider';

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
    const { localValue, onSliderChange, onSliderCommit } = useNodeSlider(id, data.value ?? 50);

    const min = data.min ?? 0;
    const max = data.max ?? 100;
    const step = data.step ?? 1;
    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-blue-500 rounded-xl min-w-[160px] p-3 hover:border-blue-400 ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <NodeHeader
                label={data.label || 'Slider'}
                icon={<Sliders className="w-3 h-3 text-blue-500" />}
                badge={localValue}
                badgeColor="text-blue-600 bg-blue-50"
                className="mb-2 w-full"
            />

            <div className="px-1">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localValue}
                    onChange={onSliderChange}
                    onMouseUp={onSliderCommit}
                    onTouchEnd={onSliderCommit}
                    className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-500 nodrag"
                />
                <div className="flex justify-between mt-1 px-0.5">
                    <span className="text-[8px] text-zinc-400 font-mono">{min}</span>
                    <span className="text-[8px] text-zinc-400 font-mono">{max}</span>
                </div>
            </div>

            <SourceHandle
                position={Position.Right}
                id="output"
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

NodeSlider.displayName = 'NodeSlider';
