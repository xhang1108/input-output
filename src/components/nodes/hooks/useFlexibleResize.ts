import { useState, useEffect, RefObject } from 'react';

export interface ResizeDimensions {
    screenW: number;
    screenH: number;
    deltaX: number;
    deltaY: number;
}

interface ResizeState {
    active: boolean;
    originX: number;
    originY: number;
    originW: number;
    originH: number;
}

interface UseFlexibleResizeProps {
    /** Ref to the element being measured */
    targetRef: RefObject<HTMLElement | null>;
    /** Callback on resize move, returning raw screen-space pixels */
    onResize: (dims: ResizeDimensions) => void;
    /** Optional callback on resize start */
    onResizeStart?: () => void;
    /** Optional callback on resize end */
    onResizeEnd?: (dims: ResizeDimensions) => void;
}

/**
 * A unified hook for "Visual Measurement" resizing.
 * It strictly measures raw screen-space pixels to ensure 1:1 mouse tracking.
 * Responsibility for Zoom compensation and Constraints belongs to the caller.
 */
export const useFlexibleResize = ({
    targetRef,
    onResize,
    onResizeStart,
    onResizeEnd
}: UseFlexibleResizeProps) => {
    const [state, setState] = useState<ResizeState>({
        active: false,
        originX: 0,
        originY: 0,
        originW: 0,
        originH: 0
    });

    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            setState({
                active: true,
                originX: e.clientX,
                originY: e.clientY,
                originW: rect.width,
                originH: rect.height
            });
            onResizeStart?.();
        }
    };

    useEffect(() => {
        if (!state.active) return;

        const handleMove = (e: PointerEvent) => {
            const deltaX = e.clientX - state.originX;
            const deltaY = e.clientY - state.originY;

            onResize({
                screenW: state.originW + deltaX,
                screenH: state.originH + deltaY,
                deltaX,
                deltaY
            });
        };

        const handleUp = (e: PointerEvent) => {
            const deltaX = e.clientX - state.originX;
            const deltaY = e.clientY - state.originY;

            onResizeEnd?.({
                screenW: state.originW + deltaX,
                screenH: state.originH + deltaY,
                deltaX,
                deltaY
            });
            setState(prev => ({ ...prev, active: false }));
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);

        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, [state, onResize, onResizeEnd]);

    return {
        handleResizeStart,
        isResizing: state.active
    };
};
