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

    // Extract display values with fallback and array support
    const raw = unwrapped;
    let hex = '#000000';
    let vec3 = [0, 0, 0];

    try {
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'hex' in (raw as object)) {
            const obj = raw as { hex: string; vec3?: number[] };
            const rawHex = String(obj.hex || '');
            hex = rawHex.startsWith('#') ? rawHex : `#${rawHex}`;
            vec3 = obj.vec3 || parseHexToVec3(hex);
        } else if (typeof raw === 'string' && raw.length > 0) {
            hex = raw.startsWith('#') ? raw : `#${raw}`;
            vec3 = parseHexToVec3(hex);
        } else if (Array.isArray(raw) && raw.length >= 3) {
            // Support raw RGB/Vec3 array as color input
            const vals = raw.slice(0, 3).map(v => {
                const n = Number(v);
                return isNaN(n) ? 0 : n;
            });
            // Heuristic: If all values are <= 1.05 (leeway for precision), treat as Vec3
            const isVec3 = vals.every(v => v >= 0 && v <= 1.05);
            vec3 = isVec3 ? vals : vals.map(v => v / 255);
            const toHex = (c: number) => {
                const i = Math.max(0, Math.min(255, Math.round(c * 255)));
                return i.toString(16).padStart(2, '0');
            };
            hex = `#${toHex(vec3[0])}${toHex(vec3[1])}${toHex(vec3[2])}`;
        }
    } catch (e) {
        console.error("ColorView: Parsing failed", e);
    }

    const displayHex = hex;
    const currentVec3 = vec3;

    // Display values (Integer space)
    const maxRange = depth === '10bit' ? 1023 : depth === '12bit' ? 4095 : 255;

    // Calculate integers for display from currentVec3
    const rVal = Math.round(Math.max(0, Math.min(1, currentVec3[0])) * maxRange);
    const gVal = Math.round(Math.max(0, Math.min(1, currentVec3[1])) * maxRange);
    const bVal = Math.round(Math.max(0, Math.min(1, currentVec3[2])) * maxRange);

    return (
        <div className="flex flex-col gap-2 p-1 w-[160px]">
            {/* Color Display (Visual) */}
            <div
                className="relative h-12 rounded-lg overflow-hidden border border-zinc-800 transition-colors bg-zinc-950/50 mb-2"
                style={{ backgroundColor: displayHex }}
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
                    {[currentVec3[0], currentVec3[1], currentVec3[2]].map((val, idx) => (
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
            <div className="text-[8px] text-zinc-600 text-right px-1 pt-1">Max: {maxRange} | HEX: {displayHex}</div>
        </div>
    );
});

ColorView.displayName = 'ColorView';

