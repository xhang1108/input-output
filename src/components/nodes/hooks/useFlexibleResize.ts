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
        let frame = 0;
        let pending: PointerEvent | null = null;

        const toDims = (e: PointerEvent): ResizeDimensions => {
            const deltaX = (e.clientX - state.originX) / z;
            const deltaY = (e.clientY - state.originY) / z;
            return {
                screenW: state.originW / z + deltaX,
                screenH: state.originH / z + deltaY,
                deltaX,
                deltaY
            };
        };

        // Coalesce pointer moves to one update per frame. Browsers can emit
        // several moves between paints; each update resizes a DOM node that
        // React Flow measures with a ResizeObserver, so unfiltered bursts
        // trigger that observer's "undelivered notifications" warning.
        const flush = () => {
            frame = 0;
            if (pending) {
                const e = pending;
                pending = null;
                onResize(toDims(e));
            }
        };

        const handleMove = (e: PointerEvent) => {
            pending = e;
            if (!frame) frame = requestAnimationFrame(flush);
        };

        const finish = (e: PointerEvent) => {
            if (frame) {
                cancelAnimationFrame(frame);
                frame = 0;
            }
            pending = null;
            onResizeEnd?.(toDims(e));
            setState(prev => ({ ...prev, active: false }));
        };

        // pointercancel must not leave the canvas stuck in resize mode.
        const handleCancel = (e: PointerEvent) => finish(e);

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', handleCancel);

        return () => {
            if (frame) cancelAnimationFrame(frame);
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', handleCancel);
        };
    }, [state, onResize, onResizeEnd]);

    return {
        handleResizeStart,
        isResizing: state.active
    };
};

