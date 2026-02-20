'use client';

import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { Brain } from '../../engine/Brain';
import { Copy, Check } from 'lucide-react';

/**
 * ColorResultNode (IO-19)
 * Visualizes color data (HEX, RGB, or Vec3).
 * Matches the Color Input Node (IO-18) layout with read-only fields.
 * Allows selecting Bit Depth for integer interpretation.
 */
export const ColorResultNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const [copied, setCopied] = useState(false);

    // Unwrap the payload
    const unwrapped = PayloadUtils.unwrap(data.value);

    // Extract display values (fallback to defaults if parsing failed or no input)
    const colorObject = (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped) && 'hex' in unwrapped)
        ? unwrapped as { hex: string; vec3?: number[] }
        : null;

    const hex = colorObject?.hex || '#000000';
    const vec3 = colorObject?.vec3 || [0, 0, 0];

    const depth = (data.depth as string) || '8bit';

    // Display values (Integer space)
    const maxRange = depth === '10bit' ? 1023 : depth === '12bit' ? 4095 : 255;

    // Calculate integers for display from vec3
    const rVal = Math.round(Math.max(0, Math.min(1, vec3[0])) * maxRange);
    const gVal = Math.round(Math.max(0, Math.min(1, vec3[1])) * maxRange);
    const bVal = Math.round(Math.max(0, Math.min(1, vec3[2])) * maxRange);

    const handleDepthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { depth: e.target.value }
            }
        });
    }, [id]);

    const copyToClipboard = () => {
        if (hex) {
            navigator.clipboard.writeText(hex);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 w-[160px]">
                {/* Header / Primary Value Preview */}
                <div className="flex items-center justify-between gap-2 px-1 mb-1">
                    <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Result</label>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase truncate max-w-[80px]" title={hex}>
                            {hex}
                        </span>
                        <button
                            onClick={copyToClipboard}
                            className={`nodrag p-1 rounded hover:bg-zinc-800 transition-colors shrink-0 ${copied ? 'text-green-500' : 'text-zinc-500'}`}
                        >
                            {copied ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                    </div>
                </div>

                {/* Color Display (Visual) */}
                <div
                    className="relative h-12 rounded-lg overflow-hidden border border-zinc-800 transition-colors bg-zinc-950/50 mb-2"
                    style={{ backgroundColor: hex }}
                />

                {/* RGB Channels (Read Only) */}
                <div className="grid grid-cols-3 gap-1 px-1">
                    {['R', 'G', 'B'].map((label, idx) => (
                        <div key={label} className="flex flex-col gap-1">
                            <label className="text-[8px] text-zinc-600 font-bold text-center">{label}</label>
                            <input
                                type="number"
                                readOnly
                                className="w-full bg-zinc-900 border border-zinc-800 rounded text-[9px] text-center text-zinc-500 py-1 focus:outline-none cursor-default nodrag"
                                value={[rVal, gVal, bVal][idx]}
                            />
                        </div>
                    ))}
                </div>

                {/* Vec3 (Read Only) */}
                <div className="flex flex-col gap-1 px-1 mt-2">
                    <label className="text-[8px] text-zinc-600 font-bold uppercase">Vec3</label>
                    <div className="grid grid-cols-3 gap-1">
                        {[vec3[0], vec3[1], vec3[2]].map((val, idx) => (
                            <input
                                key={`vec3-${idx}`}
                                type="number"
                                readOnly
                                className="w-full bg-zinc-900 border border-zinc-800 rounded text-[9px] text-center text-zinc-500 py-1 focus:outline-none cursor-default nodrag"
                                value={(val || 0).toFixed(3)}
                            />
                        ))}
                    </div>
                </div>

                {/* Depth Control */}
                <div className="flex items-center justify-between px-1 pt-2 border-t border-zinc-800/50 mt-1">
                    <label className="text-[9px] text-zinc-500 font-bold uppercase">Depth</label>
                    <select
                        className="h-4 text-[8px] bg-zinc-900 border border-zinc-700 rounded px-1 focus:outline-none focus:border-blue-500 text-zinc-300"
                        value={depth}
                        onChange={handleDepthChange}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <option value="8bit">8-bit</option>
                        <option value="10bit">10-bit</option>
                        <option value="12bit">12-bit</option>
                    </select>
                </div>

                <div className="text-[8px] text-zinc-600 text-right px-1">Max: {maxRange}</div>
            </div>
        </BaseNode>
    );
});

ColorResultNode.displayName = 'ColorResultNode';
