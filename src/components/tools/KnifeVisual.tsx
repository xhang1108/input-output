import { memo } from 'react';

interface KnifeVisualProps {
    path: { x: number; y: number }[];
}

export const KnifeVisual = memo(({ path }: KnifeVisualProps) => {
    if (path.length < 2) return null;

    // Convert points to SVG path data (M x y L x y ...)
    const d = path.reduce((acc, point, i) => {
        return `${acc} ${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
    }, '');

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-[9999]"
            style={{ overflow: 'visible' }}
        >
            <path
                d={d}
                stroke="#ef4444" // red-500
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-80"
            />
        </svg>
    );
});
