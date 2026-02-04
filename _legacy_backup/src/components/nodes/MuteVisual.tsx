import { useState, useEffect, useRef, DependencyList, RefObject } from 'react';
import { getRelativePosition } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';

export interface LineCoords {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/**
 * Hook to handle mute line coordinate calculation
 * @param isMuted Whether the node is currently muted
 * @param deps Additional dependencies that should trigger a recalculation (e.g. operation mode)
 * @returns refs and calculated coordinates
 */
export function useMuteLine(isMuted: boolean, deps: DependencyList = []) {
    const containerRef = useRef<HTMLDivElement>(null);
    const inputARef = useRef<HTMLDivElement>(null);
    const outputRef = useRef<HTMLDivElement>(null);
    const [lineCoords, setLineCoords] = useState<LineCoords | null>(null);

    useEffect(() => {
        if (isMuted && containerRef.current && inputARef.current && outputRef.current) {
            const startPos = getRelativePosition(inputARef.current, containerRef.current);
            const endPos = getRelativePosition(outputRef.current, containerRef.current);

            setLineCoords({
                x1: startPos.x,
                y1: startPos.y,
                x2: endPos.x + outputRef.current.offsetWidth,
                y2: endPos.y,
            });
        } else {
            setLineCoords(null);
        }
    }, [isMuted, ...deps]);

    return { containerRef, inputARef, outputRef, lineCoords };
}

interface MuteLineProps {
    coords: LineCoords | null;
    color: string;
    opacity?: number;
}

/**
 * Shared SVG component to render the mute pass-through line
 */
export function MuteLine({ coords, color, opacity = 0.6 }: MuteLineProps) {
    const { displayMode, settings } = useAppStore();
    if (!coords) return null;

    const strokeWidth = displayMode === 'formula' ? 3 : 2;
    const shouldAnimate = settings.enableAnimations;

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-100"
            style={{ overflow: 'visible' }}
        >
            <line
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke={color}
                strokeWidth={strokeWidth}
                className=""
                strokeDasharray={shouldAnimate ? "5 5" : undefined}
                style={{ opacity, animation: shouldAnimate ? 'dash-flow 0.5s linear infinite' : 'none' }}
            />
        </svg>
    );
}
