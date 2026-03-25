'use client';

import { memo, useCallback, useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NodeOpSelect } from './NodeOpSelect';

/**
 * ColorNode (IO-18)
 * A visual input node for color selection.
 * Provides HEX, RGB, and Vec3 outputs simultaneously.
 */
export const ColorNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

    const depth = (data.depth as string) || '8bit';
    const maxRange = depth === '10bit' ? 1023 : depth === '12bit' ? 4095 : 255;

    // Unwrap the payload to get the actual value
    const unwrapped = PayloadUtils.unwrap(data.value);

    // Local state for immediate feedback
    const [localVal, setLocalVal] = useState(unwrapped);

    // Sync from parent only when not receiving local updates
    useEffect(() => {
        setLocalVal(unwrapped);
    }, [unwrapped]);

    const colorObj = (typeof localVal === 'object' && localVal !== null) ? localVal as Record<string, unknown> : null;

    // If unwrapped is an object with hex/rgb/vec3, extract hex; otherwise use as string
    const rawDisplay = (colorObj && typeof colorObj.hex === 'string')
        ? colorObj.hex
        : (typeof localVal === 'string' ? localVal : '3b82f6');
    
    const displayColor = rawDisplay.startsWith('#') ? rawDisplay : `#${rawDisplay}`;

    // Vec3 normalized channels
    let rNorm = 0, gNorm = 0, bNorm = 0;
    if (colorObj && Array.isArray(colorObj.vec3)) {
        const v3 = colorObj.vec3 as number[];
        [rNorm, gNorm, bNorm] = [v3[0] ?? 0, v3[1] ?? 0, v3[2] ?? 0];
    } else {
        const hex = displayColor.startsWith('#') ? displayColor : '#3abff8';
        rNorm = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
        gNorm = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
        bNorm = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
    }

    // Display values (Integer space)
    const rVal = Math.round(rNorm * maxRange);
    const gVal = Math.round(gNorm * maxRange);
    const bVal = Math.round(bNorm * maxRange);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const hex = e.target.value;
        const r = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
        const g = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
        const b = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
        const newVal = { hex, vec3: [r, g, b] };

        setLocalVal(newVal);
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { value: newVal } }
        });
    }, [id, brain]);

    const handleChannelChange = useCallback((channel: 0 | 1 | 2, val: number) => {
        const newVec3 = [rNorm, gNorm, bNorm];
        newVec3[channel] = val / maxRange;

        const toHex = (c: number) => Math.max(0, Math.min(255, Math.round(c * 255))).toString(16).padStart(2, '0');
        const newHex = `#${toHex(newVec3[0])}${toHex(newVec3[1])}${toHex(newVec3[2])}`;
        const newVal = { hex: newHex, vec3: newVec3 };

        setLocalVal(newVal);
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { value: newVal } }
        });
    }, [id, maxRange, rNorm, gNorm, bNorm, brain]);

    const handleVec3Change = useCallback((idx: number, newVal: number) => {
        const newVec3 = [rNorm, gNorm, bNorm];
        newVec3[idx] = newVal;

        const toHex = (c: number) => Math.max(0, Math.min(255, Math.round(c * 255))).toString(16).padStart(2, '0');
        const newHex = `#${toHex(newVec3[0])}${toHex(newVec3[1])}${toHex(newVec3[2])}`;
        const nextVal = { hex: newHex, vec3: newVec3 };

        setLocalVal(nextVal);
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { value: nextVal } }
        });
    }, [id, rNorm, gNorm, bNorm, brain]);

    return (
        <BaseNode {...props}>
            <div 
                className="flex flex-col gap-2 p-1 w-[160px]"
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* Header / Primary Value Preview */}
                <div className="flex items-center justify-between gap-2 px-1 mb-1">
                    <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Color</label>
                    <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase truncate max-w-[120px]" title={displayColor}>
                        {displayColor}
                    </span>
                </div>

                {/* Color Picker (Visual coarse control) */}
                <div className="relative h-12 rounded-lg overflow-hidden border border-zinc-800 focus-within:border-cloud/50 transition-colors bg-zinc-950/50 mb-2">
                    <input
                        type="color"
                        className="nodrag absolute inset-0 w-full h-full cursor-pointer bg-transparent border-0 p-0 scale-[1.5]"
                        value={displayColor}
                        onChange={handleChange}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                </div>

                {/* Fine Control Channels */}
                <div className="grid grid-cols-3 gap-1 px-1">
                    {['R', 'G', 'B'].map((label, idx) => (
                        <div key={label} className="flex flex-col gap-1">
                            <label className="text-[8px] text-zinc-600 font-bold text-center">{label}</label>
                            <FloatInput
                                value={[rVal, gVal, bVal][idx]}
                                max={maxRange}
                                min={0}
                                step={1}
                                decimals={0}
                                onChange={(v) => handleChannelChange(idx as 0 | 1 | 2, v)}
                            />
                        </div>
                    ))}
                </div>

                {/* Vec3 Controls */}
                <div className="flex flex-col gap-1 px-1 mt-2">
                    <label className="text-[8px] text-zinc-600 font-bold uppercase">Vec3</label>
                    <div className="grid grid-cols-3 gap-1">
                        {[rNorm, gNorm, bNorm].map((val, idx) => (
                            <FloatInput
                                key={`vec3-${idx}`}
                                value={val}
                                step={0.01}
                                min={0}
                                max={1}
                                onChange={(v) => handleVec3Change(idx, v)}
                            />
                        ))}
                    </div>
                </div>


                {/* Depth Control */}
                <div className="flex flex-col border-t border-zinc-800/50 mt-1">
                    <NodeOpSelect
                        nodeId={id}
                        defId="IN-03"
                        paramId="depth"
                        data={data}
                        label="Bit Depth"
                        width="40"
                    />
                </div>

                <div className="text-[8px] text-zinc-600 text-right px-1 mt-1">Max: {maxRange}</div>
            </div>
        </BaseNode >
    );
});

ColorNode.displayName = 'ColorNode';

/**
 * Smart Input Component
 * Handles local state for smooth typing. Supports both integers and floats.
 * Uses type="number" for native stepper (Up/Down) support.
 */
const FloatInput = ({ value, onChange, min = 0, max = 1, step = 0.01, decimals = 3 }: {
    value: number, onChange: (val: number) => void,
    min?: number, max?: number, step?: number, decimals?: number
}) => {
    const fmt = (v: number) => v.toFixed(decimals);
    const [localStr, setLocalStr] = useState(fmt(value));
    const [isFocused, setIsFocused] = useState(false);

    // Sync from parent only when NOT focused (using state transition during render)
    const [prevValue, setPrevValue] = useState(value);
    if (value !== prevValue && !isFocused) {
        setPrevValue(value);
        setLocalStr(fmt(value));
    }

    return (
        <input
            type="number"
            className="w-full bg-zinc-900 border border-zinc-800 rounded text-[9px] text-center text-zinc-500 py-1 focus:border-focus focus:outline-none nodrag"
            value={localStr}
            step={step}
            min={min}
            max={max}
            onChange={(e) => {
                setLocalStr(e.target.value);
                const parsed = parseFloat(e.target.value);
                if (!isNaN(parsed)) onChange(parsed);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
                setIsFocused(false);
                const parsed = parseFloat(localStr) || 0;
                const clamped = Math.max(min, Math.min(max, parsed));
                setLocalStr(fmt(clamped));
                if (parsed !== clamped) onChange(clamped);
            }}
        />
    );
};
