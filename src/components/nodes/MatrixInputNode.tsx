import { memo, useCallback, useRef, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import * as math from 'mathjs';
import { useNodeDebounce } from './hooks/useNodeDebounce';
import { useVisualGridResize } from './hooks/useVisualGridResize';

/**
 * 🧱 MatrixInputNode (IO-08)
 * 
 * Matrix input node with resizable grid.
 */
export const MatrixInputNode = memo((props: NodeProps) => {
    const { id, data, selected } = props;

    // Grid Dimensions State
    // We initialize from data if available, otherwise default to 3x3
    const initialGrid = (data.rawExpression ? JSON.parse(data.rawExpression as string) : [[0, 0, 0], [0, 0, 0], [0, 0, 0]]) as number[][];
    const [rows, setRows] = useState(initialGrid.length);
    const [cols, setCols] = useState(initialGrid[0]?.length || 1);

    const gridRef = useRef<HTMLDivElement>(null);

    // Debounced Grid State & Sync
    const [grid, setGrid] = useNodeDebounce<number[][]>(
        id,
        initialGrid,
        useCallback((newGrid) => {
            try {
                // Create MathJS Matrix
                const mat = math.matrix(newGrid);

                return {
                    // Update the 'value' field which the engine observes
                    value: mat,
                    // Store raw expression for persistence
                    rawExpression: JSON.stringify(newGrid),
                    // Metadata
                    label: 'Matrix',
                    isMatrix: true,
                    // Helper for size
                    rows: newGrid.length,
                    cols: newGrid[0]?.length || 1
                };
            } catch (e) {
                console.error("Matrix Sync Error", e);
                return {};
            }
        }, [])
    );

    // Cell Edit Handler
    const handleCellChange = (r: number, c: number, val: string) => {
        const num = parseFloat(val);
        const newGrid = grid.map(row => [...row]); // Deep copy rows
        newGrid[r][c] = isNaN(num) ? 0 : num;
        setGrid(newGrid);
    };

    // Resize Logic
    const { handleResizeStart, isResizing } = useVisualGridResize({
        gridRef,
        rows,
        cols,
        onResize: (newRows, newCols) => {
            setGrid(currentGrid => {
                const currentRows = currentGrid.length;
                const currentCols = currentGrid[0]?.length || 1;

                if (newRows === currentRows && newCols === currentCols) return currentGrid;

                let nextGrid = [...currentGrid];

                // 1. Adjust Rows
                if (newRows > currentRows) {
                    const rowsToAdd = newRows - currentRows;
                    const newRowsArr = Array(rowsToAdd).fill(0).map(() => Array(currentCols).fill(0));
                    nextGrid = [...nextGrid, ...newRowsArr];
                } else if (newRows < currentRows) {
                    nextGrid = nextGrid.slice(0, newRows);
                }

                // 2. Adjust Cols (for every row)
                if (newCols !== currentCols) {
                    nextGrid = nextGrid.map(row => {
                        if (newCols > row.length) {
                            const colsToAdd = newCols - row.length;
                            return [...row, ...Array(colsToAdd).fill(0)];
                        } else if (newCols < row.length) {
                            return row.slice(0, newCols);
                        }
                        return row;
                    });
                }

                // Update local dimension state
                setRows(nextGrid.length);
                setCols(nextGrid[0]?.length || 1);

                return nextGrid;
            });
        }
    });

    // Define Output Handle
    const handles = [
        { id: 'result', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix' }
    ];

    const nodeData = {
        ...data,
        handles,
        // Override label with matrix size for the header
        label: `Matrix ${rows}×${cols}`
    };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="min-w-[160px] p-2 relative group">
                {/* Grid Container */}
                <div className="flex flex-col gap-1 w-fit mx-auto relative" ref={gridRef}>
                    {grid.map((row, r) => (
                        <div key={r} className="flex gap-1">
                            {row.map((cell, c) => (
                                <input
                                    key={`${r}-${c}`}
                                    type="text"
                                    className="nodrag w-10 h-8 text-center text-xs font-mono 
                                             bg-zinc-800/50 border border-zinc-700/50 rounded 
                                             text-zinc-200 focus:border-blue-500 focus:bg-zinc-800 
                                             outline-none transition-all placeholder-zinc-600"
                                    value={cell === 0 && !data.value ? '' : cell}
                                    placeholder="0"
                                    onChange={(e) => handleCellChange(r, c, e.target.value)}
                                    // Stop propagation specifically for keydown to prevent deleting node when typing backspace
                                    onKeyDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                {/* Resize Handle (Bottom Right) */}
                <div
                    className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize 
                              flex items-end justify-end p-1 z-20 
                              text-zinc-500 hover:text-blue-400 transition-colors
                              ${isResizing ? 'text-blue-500' : 'opacity-0 group-hover:opacity-100'}`}
                    onPointerDown={handleResizeStart}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 22L12 12" />
                        <path d="M16 22L22 16" />
                    </svg>
                </div>

                {/* Overlay while resizing to prevent input interference */}
                {isResizing && (
                    <div className="absolute inset-0 z-10 bg-transparent cursor-nwse-resize" />
                )}
            </div>
        </BaseNode>
    );
});

MatrixInputNode.displayName = 'MatrixInputNode';
