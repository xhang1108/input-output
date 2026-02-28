import { memo, useCallback, useRef, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position, useReactFlow } from '@xyflow/react';
import * as math from 'mathjs';
import { useNodeDebounce } from './hooks/useNodeDebounce';
import { ResizeHandle } from './ResizeHandle';
import { cn } from '@/lib/utils';
import { NodeHandle } from './NodeHandle';

/**
 * 🧱 MatrixInputNode (IO-08)
 * 
 * Matrix input node with resizable grid.
 */
export const MatrixInputNode = memo((props: NodeProps) => {
    const { id, data, selected } = props;
    const { updateNode } = useReactFlow();

    // ... (keep initialGrid calculation)
    // We initialize from data if available, otherwise default to 3x3
    const initialGrid = (() => {
        try {
            // Helper to recursively find a 2D array in the NodePayload or raw data
            const extract2DArray = (obj: any): any => {
                // If it's a MathJS Matrix object
                if (obj && typeof obj === 'object' && typeof obj.toArray === 'function') {
                    const arr = obj.toArray();
                    if (Array.isArray(arr)) {
                        if (Array.isArray(arr[0])) return arr;
                        if (typeof arr[0] === 'number') return arr.map((v: any) => [v]);
                    }
                }

                if (Array.isArray(obj)) {
                    if (Array.isArray(obj[0])) return obj;
                    // Fallback to column matrix if it's a 1D vector
                    if (typeof obj[0] === 'number') return obj.map((v: any) => [v]);
                }

                if (obj && typeof obj === 'object') {
                    if (obj.value !== undefined) return extract2DArray(obj.value);
                    if (obj.data !== undefined) return extract2DArray(obj.data);
                }
                return null;
            };

            if (typeof data.rawExpression === 'string') {
                try {
                    const parsed = JSON.parse(data.rawExpression);
                    const extracted = extract2DArray(parsed);
                    if (extracted) return extracted;
                } catch (e) { }
            }

            const extracted = extract2DArray(data.value || data);
            if (extracted) return extracted;
        } catch (e) { }
        return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    })() as number[][];
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


    // Define Output Handle
    const handles = [
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix' }
    ];

    const nodeData = {
        ...data,
        handles,
        // Override label with matrix size for the header
        label: `Matrix ${rows}×${cols}`
    };

    return (
        <div
            className={cn(
                "relative rounded-xl border transition-all duration-200 group w-fit h-fit flex flex-col items-start",
                selected
                    ? "border-zinc-400 animate-ring-pulse shadow-[0_0_0_1px_rgba(161,161,170,0.2)]"
                    : "border-zinc-700 hover:border-zinc-500"
            )}
            style={{
                background: 'var(--node-bg)',
            }}
        >
            {/* Header - Fixed Height & Left Aligned to match BaseNode design */}
            <div
                className="w-full px-3 py-2 border-b border-zinc-800/60 rounded-t-xl flex items-center justify-between"
                style={{ background: 'var(--node-bg-header)' }}
            >
                <span className="text-xs font-bold text-zinc-300 select-none uppercase tracking-tight">
                    Matrix {rows}×{cols}
                </span>
            </div>

            <div className="p-3 relative group overflow-visible">
                {/* Grid Container - Anchored Top-Left */}
                <div className="flex flex-col gap-1 w-fit relative" ref={gridRef}>
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
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            let step = 1;
                                            if (e.shiftKey) step = 0.1;
                                            if (e.altKey) step = 10;
                                            const delta = e.key === 'ArrowUp' ? step : -step;
                                            const currentVal = parseFloat(e.currentTarget.value) || 0;
                                            const newVal = parseFloat((currentVal + delta).toFixed(2));
                                            handleCellChange(r, c, String(newVal));
                                        }
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                />
                            ))}
                        </div>
                    ))}
                    <div className="absolute right-0 w-0 bottom-0 top-[38px] flex flex-col items-center justify-center pt-3 translate-x-3">
                        <NodeHandle
                            id="out"
                            type="source"
                            position={Position.Right}
                            nodeId={id}
                            isConnectable={props.isConnectable}
                            className="w-(--handle-size-sm)! h-(--handle-size-sm)! border-zinc-900! origin-center"
                            color="var(--color-scalar)"
                        />
                    </div>

                    {/* Resize Handle (Anchored to Grid Bottom Right) */}
                    <ResizeHandle
                        targetRef={gridRef}
                        position="bottom-right"
                        onResize={({ screenW, screenH }) => {
                            if (!gridRef.current) return;

                            // In V12, let `node.measured` automatically handle bounding box based on our flex layout
                            // and rows/cols state changes. No explicit width/height overrides needed.

                            const rect = gridRef.current.getBoundingClientRect();
                            const cellW = rect.width / cols;
                            const cellH = rect.height / rows;
                            const targetW = Math.max(60, screenW);
                            const targetH = Math.max(40, screenH);
                            const newCols = Math.max(1, Math.round(targetW / cellW));
                            const newRows = Math.max(1, Math.round(targetH / cellH));

                            if (newRows === rows && newCols === cols) return;

                            setGrid(currentGrid => {
                                const currentRows = currentGrid.length;
                                const currentCols = currentGrid[0]?.length || 1;
                                let nextGrid = [...currentGrid];
                                if (newRows > currentRows) {
                                    const rowsToAdd = newRows - currentRows;
                                    const newRowsArr = Array(rowsToAdd).fill(0).map(() => Array(currentCols).fill(0));
                                    nextGrid = [...nextGrid, ...newRowsArr];
                                } else if (newRows < currentRows) {
                                    nextGrid = nextGrid.slice(0, newRows);
                                }
                                if (newCols !== currentCols) {
                                    nextGrid = nextGrid.map(row => {
                                        if (newCols > row.length) {
                                            return [...row, ...Array(newCols - row.length).fill(0)];
                                        } else if (newCols < row.length) {
                                            return row.slice(0, newCols);
                                        }
                                        return row;
                                    });
                                }
                                setRows(nextGrid.length);
                                setCols(nextGrid[0]?.length || 1);
                                return nextGrid;
                            });
                        }}
                    />
                </div>
            </div>
        </div>
    );
});

MatrixInputNode.displayName = 'MatrixInputNode';
