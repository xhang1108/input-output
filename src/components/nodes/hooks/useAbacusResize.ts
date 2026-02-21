import { useState, useEffect, RefObject } from 'react';

interface ResizeState {
    active: boolean;
    originX: number;
    originW: number;
}

interface UseAbacusResizeProps {
    containerRef: RefObject<HTMLElement | null>;
    /** Called on each move: newWidth is the computed width, deltaX is the screen-pixel shift from origin (negative = dragged left) */
    onResize: (newWidth: number, deltaX: number) => void;
}

/**
 * A specialized hook for left-side horizontal resizing of the Abacus node.
 * Dragging left increases width; dragging right decreases it.
 */
export const useAbacusResize = ({
    containerRef,
    onResize
}: UseAbacusResizeProps) => {
    const [resizeState, setResizeState] = useState<ResizeState>({
        active: false,
        originX: 0,
        originW: 0
    });

    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setResizeState({
                active: true,
                originX: e.clientX,
                originW: rect.width
            });
        }
    };

    useEffect(() => {
        if (!resizeState.active) return;

        const handleMove = (e: PointerEvent) => {
            const deltaX = e.clientX - resizeState.originX;
            // Left drag: moving left (negative deltaX) increases width
            const newWidth = Math.max(60, resizeState.originW - deltaX);
            onResize(newWidth, deltaX);
        };

        const handleUp = () => {
            setResizeState(prev => ({ ...prev, active: false }));
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);

        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, [resizeState, onResize]);

    return {
        handleResizeStart,
        isResizing: resizeState.active
    };
};
