'use client';

import { Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { useState, useEffect, memo, useCallback, useRef } from 'react';
import * as math from 'mathjs';
import { NodeShell } from './NodeShell';
import { SourceHandle } from '../handles/SourceHandle';

// Helper to create empty grid
const createGrid = (rows: number, cols: number, initialData: number[][] = []) => {
    return Array(rows).fill(0).map((_, r) =>
        Array(cols).fill(0).map((_, c) => initialData[r]?.[c] ?? 0)
    );
};

export const NodeInputMatrix = memo(({ id, data, selected }: NodeProps) => {
    const { updateNodeData } = useReactFlow();

    // Initialize size and data
    const [rows, setRows] = useState(3);
    const [cols, setCols] = useState(3);
    const [grid, setGrid] = useState<number[][]>(createGrid(3, 3));
    const gridRef = useRef<HTMLDivElement>(null);

    const [localSymbol, setLocalSymbol] = useState<string>(data.symbol as string || '');

    // Debounce global update
    useEffect(() => {
        const handler = setTimeout(() => {
            try {
                // Convert to mathjs matrix
                const mat = math.matrix(grid);
                updateNodeData(id, {
                    value: mat,
                    rawExpression: JSON.stringify(grid),
                    label: 'Matrix',
                    isMatrix: true,
                    symbol: localSymbol
                });
            } catch (e) {
                // Ignore empty errors
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [grid, id, updateNodeData, localSymbol]);

    // Grid Operations
    const handleCellChange = (r: number, c: number, val: string) => {
        const num = parseFloat(val);
        const newGrid = [...grid];
        newGrid[r] = [...newGrid[r]];
        newGrid[r][c] = isNaN(num) ? 0 : num;
        setGrid(newGrid);
    };

    // Resize Logic
    const [resizeState, setResizeState] = useState<{
        active: boolean;
        originX: number;
        originY: number;
        cellW: number;
        cellH: number;
    }>({
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
            // This works regardless of Zoom or CSS scaling because clientX and rect are in the same coordinate space
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
            // Calculate target columns directly from screen pixels
            // Example: Mouse moved 100px. Cell is visually 20px. 100/20 = 5 cols.
            // Using Math.round instead of ceil prevents the grid from "jumping ahead" of the mouse
            const newCols = Math.max(1, Math.round(relX / resizeState.cellW));
            const newRows = Math.max(1, Math.round(relY / resizeState.cellH));

            setGrid(currentGrid => {
                const currentRows = currentGrid.length;
                const currentCols = currentGrid[0]?.length || 1;

                if (newRows === currentRows && newCols === currentCols) return currentGrid;

                let nextGrid = [...currentGrid];

                // 1. Adjust Rows
                if (newRows > currentRows) {
                    const rowsToAdd = newRows - currentRows;
                    // When adding rows, they come in with the current column count
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

                // Update local state to match
                setRows(nextGrid.length);
                setCols(nextGrid[0]?.length || 1);

                return nextGrid;
            });
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
    }, [resizeState]);

    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-blue-600 rounded-xl p-3 min-w-fit hover:border-blue-500 transition-colors relative ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <div className="flex flex-col gap-2">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Matrix</span>
                        <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-1 rounded">{rows}×{cols}</span>
                    </div>

                    <input
                        className="w-8 text-[10px] bg-zinc-100 border-none rounded text-center text-purple-600 font-bold focus:ring-1 focus:ring-purple-400 placeholder-zinc-300"
                        placeholder="M"
                        value={localSymbol}
                        onChange={(e) => setLocalSymbol(e.target.value)}
                        title="Variable Name"
                    />
                </div>

                {/* Grid UI Container */}
                <div className="flex flex-col gap-1 w-full relative">
                    {/* The Grid */}
                    <div className="flex flex-col gap-1" ref={gridRef}>
                        {grid.map((row, r) => (
                            <div key={r} className="flex gap-1">
                                {row.map((cell, c) => (
                                    <input
                                        key={`${r}-${c}`}
                                        className="w-10 h-8 text-center text-sm font-bold font-mono bg-zinc-50 border border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-sm text-zinc-900"
                                        value={cell === 0 && !data.value ? '' : cell}
                                        onChange={(e) => handleCellChange(r, c, e.target.value)}
                                        onKeyDown={(e) => e.stopPropagation()}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Resize Handle (Rounded Corner) - Positioned absolute to NodeShell */}
            <div
                className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end opacity-50 hover:opacity-100 transition-opacity z-20 pb-1 pr-1"
                onPointerDown={handleResizeStart}
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                    <path d="M22 8C22 16 16 22 8 22" />
                </svg>
            </div>

            <SourceHandle
                position={Position.Right}
                id="output"
            />
        </NodeShell >
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data.value === next.data.value &&
    prev.data.symbol === next.data.symbol &&
    prev.data.muted === next.data.muted
));
