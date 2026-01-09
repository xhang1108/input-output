import { useState, useEffect, RefObject } from 'react';

interface ResizeState {
    active: boolean;
    originX: number;
    originY: number;
    cellW: number;
    cellH: number;
}

interface UseVisualGridResizeProps {
    gridRef: RefObject<HTMLElement>;
    rows: number;
    cols: number;
    // Callback to update grid size
    onResize: (newRows: number, newCols: number) => void;
}

/**
 * A hook that implements "Visual Measurement" resizing.
 * It measures the actual DOM element size to determine cell dimensions,
 * ensuring 1:1 mouse tracking regardless of Zoom level or CSS transforms.
 */
export const useVisualGridResize = ({
    gridRef,
    rows,
    cols,
    onResize
}: UseVisualGridResizeProps) => {
    const [resizeState, setResizeState] = useState<ResizeState>({
        active: false,
        originX: 0,
        originY: 0,
        cellW: 0,
        cellH: 0
    });

    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (gridRef.current) {
            const rect = gridRef.current.getBoundingClientRect();
            // Measure actual visual size of one cell
            // This works regardless of Zoom or CSS scaling because 
            // both clientX and rect are in the same Viewport Pixel coordinate space
            const singleCellW = rect.width / cols;
            const singleCellH = rect.height / rows;

            setResizeState({
                active: true,
                originX: rect.left,
                originY: rect.top,
                cellW: singleCellW,
                cellH: singleCellH
            });
        }
    };

    useEffect(() => {
        if (!resizeState.active) return;

        const handleMove = (e: PointerEvent) => {
            const relX = e.clientX - resizeState.originX;
            const relY = e.clientY - resizeState.originY;

            // Calculate target columns directly from screen pixels
            // Example: Mouse moved 100px. Cell is visually 20px. 100/20 = 5 cols.
            // Using Math.round instead of ceil prevents the grid from "jumping ahead" of the mouse
            const newCols = Math.max(1, Math.round(relX / resizeState.cellW));
            const newRows = Math.max(1, Math.round(relY / resizeState.cellH));

            // Only notify if dimensions actually changed
            if (newCols !== cols || newRows !== rows) {
                onResize(newRows, newCols);
            }
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
    }, [resizeState, rows, cols, onResize]);

    return {
        handleResizeStart,
        isResizing: resizeState.active
    };
};
