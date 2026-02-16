'use client';

import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { PayloadUtils } from '../../utils/PayloadUtils';

/**
 * ColorNode (IO-18)
 * A visual input node for color selection.
 * Provides HEX, RGB, and Vec3 outputs simultaneously.
 */
export const ColorNode = memo((props: NodeProps) => {
    const { id, data } = props;

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_VALUE',
            payload: { id, value: val }
        });
    }, [id]);

    // Unwrap the payload to get the actual value
    const unwrapped = PayloadUtils.unwrap(data.value);
    // If unwrapped is an object with hex/rgb/vec3, extract hex; otherwise use as string
    const displayColor = (typeof unwrapped === 'object' && unwrapped?.hex)
        ? unwrapped.hex
        : (typeof unwrapped === 'string' ? unwrapped : '#3b82f6');

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1">
                <div className="flex items-center justify-between gap-2 px-1">
                    <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Color</label>
                    <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase">{displayColor}</span>
                </div>

                <div className="relative h-10 group/color rounded-lg overflow-hidden border border-zinc-800 focus-within:border-blue-500/50 transition-colors bg-zinc-950/50">
                    <input
                        type="color"
                        className="nodrag absolute inset-0 w-full h-full cursor-pointer bg-transparent border-0 p-0 scale-[1.5]"
                        defaultValue={displayColor}
                        onChange={handleChange}
                        onMouseDown={(e) => e.stopPropagation()}
                    />

                    {/* Visual Overlay to improve look of native color picker */}
                    <div
                        className="absolute inset-x-0 bottom-0 h-1 pointer-events-none opacity-50 transition-opacity group-hover/color:opacity-100"
                        style={{ background: displayColor }}
                    />
                </div>

                <div className="flex justify-between items-center px-1 pt-1 border-t border-zinc-800/50 mt-1">
                    <div className="flex flex-col">
                        <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-tighter">RGB & Vec3</span>
                        <div className="flex gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/30" />
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/10" />
                        </div>
                    </div>
                    <div className="text-[8px] text-zinc-700 italic">3 Outputs</div>
                </div>
            </div>
        </BaseNode>
    );
});

ColorNode.displayName = 'ColorNode';
