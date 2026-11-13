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
    originZoom: number;
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
    /** Fallback canvas zoom when getZoom is not supplied */
    zoom?: number;
    /** Read the live zoom at pointerdown; avoids a stale memoized prop. */
    getZoom?: () => number;
}

export const useFlexibleResize = ({
    targetRef,
    onResize,
    onResizeStart,
    onResizeEnd,
    zoom = 1,
    getZoom
}: UseFlexibleResizeProps) => {
    const [state, setState] = useState<ResizeState>({
        active: false,
        originX: 0,
        originY: 0,
        originW: 0,
        originH: 0,
        originZoom: 1
    });

    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            const startZoom = getZoom ? getZoom() : zoom;
            setState({
                active: true,
                originX: e.clientX,
                originY: e.clientY,
                originW: rect.width,
                originH: rect.height,
                originZoom: startZoom || 1
            });
            onResizeStart?.();
        }
    };

    useEffect(() => {
        if (!state.active) return;

        const z = state.originZoom || 1;

        const handleMove = (e: PointerEvent) => {
            const deltaX = (e.clientX - state.originX) / z;
            const deltaY = (e.clientY - state.originY) / z;

            onResize({
                screenW: state.originW / z + deltaX,
                screenH: state.originH / z + deltaY,
                deltaX,
                deltaY
            });
        };

        const handleUp = (e: PointerEvent) => {
            const deltaX = (e.clientX - state.originX) / z;
            const deltaY = (e.clientY - state.originY) / z;

            onResizeEnd?.({
                screenW: state.originW / z + deltaX,
                screenH: state.originH / z + deltaY,
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

