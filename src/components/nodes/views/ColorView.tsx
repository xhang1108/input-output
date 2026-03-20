import React, { memo } from 'react';
import { NodePayload } from '../../../types/payload';
import { PayloadUtils } from '../../../utils/PayloadUtils';

interface ColorViewProps {
    payload: NodePayload;
    depth: string;
    onDepthChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const ColorView: React.FC<ColorViewProps> = memo(({ payload, depth, onDepthChange }) => {
    // Unwrap the payload
    const unwrapped = PayloadUtils.unwrap(payload);

    // Helper to parse hex to normalized [0,1] RGB
    const parseHexToVec3 = (h: string): number[] => {
        const clean = h.replace('#', '');
        if (clean.length !== 6) return [0, 0, 0];
        return [
            parseInt(clean.slice(0, 2), 16) / 255,
            parseInt(clean.slice(2, 4), 16) / 255,
            parseInt(clean.slice(4, 6), 16) / 255
        ];
    };

    // Extract display values (fallback to defaults if parsing failed or no input)
    const raw = unwrapped;
    const colorObject = (raw && typeof raw === 'object' && !Array.isArray(raw) && 'hex' in (raw as object))
        ? raw as { hex: string; vec3?: number[] }
        : (typeof raw === 'string' && raw.startsWith('#'))
            ? { hex: raw, vec3: parseHexToVec3(raw) }
            : null;

    const hex = colorObject?.hex || (typeof raw === 'string' && raw.length > 0 ? (raw.startsWith('#') ? raw : `#${raw}`) : '#000000');
    const vec3 = colorObject?.vec3 || (hex.startsWith('#') ? parseHexToVec3(hex) : [0, 0, 0]);

    // Display values (Integer space)
    const maxRange = depth === '10bit' ? 1023 : depth === '12bit' ? 4095 : 255;

    // Calculate integers for display from vec3
    const rVal = Math.round(Math.max(0, Math.min(1, vec3[0])) * maxRange);
    const gVal = Math.round(Math.max(0, Math.min(1, vec3[1])) * maxRange);
    const bVal = Math.round(Math.max(0, Math.min(1, vec3[2])) * maxRange);

    return (
        <div className="flex flex-col gap-2 p-1 w-[160px]">
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
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-sm text-[9px] text-center text-zinc-500 py-1 focus:outline-none cursor-default nodrag"
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
            {onDepthChange && (
                <div className="flex items-center justify-between px-1 pt-2 border-t border-zinc-800/50 mt-1">
                    <label className="text-[9px] text-zinc-500 font-bold uppercase">Depth</label>
                    <select
                        className="h-4 text-[8px] bg-zinc-900 border border-zinc-700 rounded-sm px-1 focus:outline-none focus:border-focus text-zinc-300"
                        value={depth}
                        onChange={onDepthChange}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <option value="8bit">8-bit</option>
                        <option value="10bit">10-bit</option>
                        <option value="12bit">12-bit</option>
                    </select>
                </div>
            )}
            <div className="text-[8px] text-zinc-600 text-right px-1 pt-1">Max: {maxRange} | HEX: {hex}</div>
        </div>
    );
});

ColorView.displayName = 'ColorView';
