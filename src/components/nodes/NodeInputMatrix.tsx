'use client';

import { Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { useState, memo, useCallback, useRef } from 'react';
import * as math from 'mathjs';
import { NodeShell } from './NodeShell';
import { SourceHandle } from '../handles/SourceHandle';
import { useVisualGridResize } from './hooks/useVisualGridResize';
import { NodeHeader } from './NodeHeader';
import { useNodeDebounce } from './hooks/useNodeDebounce';

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

    // Grid uses useNodeDebounce for store syncing
    const [grid, setGrid] = useNodeDebounce<number[][]>(
        id,
        JSON.parse(data.rawExpression as string || '[[0,0,0],[0,0,0],[0,0,0]]'),
        useCallback((newGrid) => {
            try {
                const mat = math.matrix(newGrid);
                return {
                    value: mat,
                    rawExpression: JSON.stringify(newGrid),
                    label: 'Matrix',
                    isMatrix: true
                };
            } catch (e) {
                return {};
            }
        }, [])
    );

    const gridRef = useRef<HTMLDivElement>(null);

    // Symbol also uses debounce hook
    const [localSymbol, setLocalSymbol] = useNodeDebounce(
        id,
        data.symbol as string || '',
        useCallback((val) => ({ symbol: val }), [])
    );

    // Grid Operations
    const handleCellChange = (r: number, c: number, val: string) => {
        const num = parseFloat(val);
        const newGrid = [...grid];
        newGrid[r] = [...newGrid[r]];
        newGrid[r][c] = isNaN(num) ? 0 : num;
        setGrid(newGrid);
    };

    // Resize Logic using atomic hook
    const { handleResizeStart } = useVisualGridResize({
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

    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-blue-600 rounded-xl p-3 min-w-fit hover:border-blue-500 transition-colors relative ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <div className="flex flex-col gap-2">
                <NodeHeader
                    label="Matrix"
                    badge={`${rows}×${cols}`}
                    badgeColor="text-blue-500 bg-blue-50"
                    symbolInput={{
                        value: localSymbol,
                        onChange: setLocalSymbol
                    }}
                />

                {/* Grid UI Container */}
                <div className="flex flex-col gap-1 w-full relative">
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

            {/* Resize Handle */}
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
