import { useCallback } from 'react';
import { useReactFlow, XYPosition } from '@xyflow/react';

/**
 * useCanvasProjection
 * 
 * A utility hook to decouple coordinate conversion logic from business logic.
 * Centralizes screen-to-flow and flow-to-screen transformations.
 */
export function useCanvasProjection() {
    const { screenToFlowPosition, flowToScreenPosition, getZoom, getViewport } = useReactFlow();

    /**
     * Converts raw screen coordinates (clientX/Y) to flow/canvas coordinates.
     */
    const project = useCallback((screenPos: XYPosition): XYPosition => {
        return screenToFlowPosition(screenPos, { snapToGrid: false });
    }, [screenToFlowPosition]);

    /**
     * Converts flow/canvas coordinates back to screen coordinates.
     */
    const unproject = useCallback((flowPos: XYPosition): XYPosition => {
        return flowToScreenPosition(flowPos);
    }, [flowToScreenPosition]);

    /**
     * Extracts flow-space coordinates directly from a MouseEvent.
     */
    const getEventFlowPos = useCallback((e: MouseEvent | React.MouseEvent): XYPosition => {
        return screenToFlowPosition({ x: e.clientX, y: e.clientY }, { snapToGrid: false });
    }, [screenToFlowPosition]);

    /**
     * Gets the current zoom level of the viewport.
     * Useful for calculating move increments that should be scale-independent.
     */
    const getCurrentZoom = useCallback(() => {
        return getZoom();
    }, [getZoom]);

    return {
        project,
        unproject,
        getEventFlowPos,
        getCurrentZoom,
        getViewport,
        // Expose internally for advanced cases
        screenToFlowPosition,
        flowToScreenPosition
    };
}

