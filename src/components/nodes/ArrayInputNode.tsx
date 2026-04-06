import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useHistoryStore } from '../../store/useHistoryStore';
import { Transaction } from '../../engine/types/engineTypes';
import * as math from 'mathjs';
import { BaseNode } from './BaseNode';
import { ResizeHandle } from './ResizeHandle';
import { useNodeDimensions } from './hooks/useNodeDimensions';
import { useNodeDebounce } from './hooks/useNodeDebounce';
import { NumericInput } from '../common/NumericInput';
import { Brain } from '../../engine/Brain';

/**
 * ArrayInputNode (IO-08)
 * Standard matrix entry node with dynamic resizing.
 * Snaps to grid steps (44px horizontal, 36px vertical).
 */
export const ArrayInputNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();
    const pushHistory = useHistoryStore(s => s.push);
    const isRestoring = useHistoryStore(s => s.isRestoring);
    const initialGridRef = useRef<any[][] | null>(null);

    // --- Grid State Management ---
    const initialGrid = useMemo(() => {
        try {
            const extract2DArray = (val: any): any[][] | null => {
                if (!val) return null;

                // 1. If val is a string, try parsing it
                if (typeof val === 'string') {
                    try {
                        const parsed = JSON.parse(val);
                        return extract2DArray(parsed); // Recursive unwrap
                    } catch (e) { return null; }
                }

                // 2. If it's a 2D array of numbers/strings, return as is
                if (Array.isArray(val) && val.length > 0 && Array.isArray(val[0])) {
                    // Check for nested double-stringification: [["[[1,2],...]]"]]
                    if (val.length === 1 && val[0].length === 1 && typeof val[0][0] === 'string' && val[0][0].startsWith('[[')) {
                        try {
                            return extract2DArray(val[0][0]);
                        } catch (e) { }
                    }
                    return val;
                }

                // 3. Handle Object/Payload formats
                if (typeof val === 'object') {
                    // Property match (Mapped from manifest.ts or direct data)
                    const arrayProp = val.array ?? val.value;
                    if (arrayProp !== undefined) {
                        // If it's a payload: { type: 'array', value: [...] }
                        if (arrayProp && typeof arrayProp === 'object' && 'type' in arrayProp && 'value' in arrayProp) {
                            return extract2DArray((arrayProp as any).value);
                        }
                        return extract2DArray(arrayProp);
                    }
                }
                return null;
            };

            const extractedFromData = extract2DArray(data);
            if (extractedFromData) return extractedFromData;

        } catch (e) {
            console.error("[ArrayInputNode] Extraction Critical Failure", e);
        }
        // Strict fallback to 3x3 to match nodeDefinitions default
        return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    }, [data]); // Only re-calculate when data property changes (structural sync)

    const nodeRef = useRef<HTMLDivElement>(null);

    // Debounced Grid State & Sync
    const [grid, setGrid] = useNodeDebounce<any[][]>(
        id,
        initialGrid,
        useCallback((newGrid) => {
            try {
                // We keep the raw grid for UI, and create a math instance (matrix) for the engine
                // math.matrix handles strings/scalars gracefully.
                const mat = math.matrix(newGrid);
                return {
                    array: newGrid,
                    value: mat,
                    rawExpression: JSON.stringify(newGrid),
                    isMatrix: true,
                    rows: newGrid.length,
                    cols: newGrid[0]?.length || 1
                };
            } catch (e) {
                console.error("Matrix Sync Error", e);
                return {};
            }
        }, [])
    );
    const rows = grid.length;
    const cols = grid[0]?.length || 1;


    // Dimension management via unified hook
    const { width, height, onResize, onResizeStart, onResizeEnd } = useNodeDimensions({
        id,
        type: 'IN-07',
        data,
        onProject: (screenW, screenH) => ({
            w: Math.max(1, Math.round((screenW - 20) / 44)) * 44 + 20,
            h: Math.max(1, Math.round((screenH - 52) / 36)) * 36 + 52
        }),
        onResize: useCallback(({ width: newWidth, height: newHeight }: { width: number; height: number }) => {
            const currentRows = grid.length;
            const currentCols = grid[0]?.length || 1;

            const newCols = Math.max(1, Math.round((newWidth - 20) / 44));
            const newRows = Math.max(1, Math.round((newHeight - 52) / 36));

            if (newRows === currentRows && newCols === currentCols) return;

            const newGrid = Array(newRows).fill(0).map((_, r) =>
                Array(newCols).fill(0).map((_, c) => grid[r]?.[c] ?? 0)
            );
            setGrid(newGrid);
        }, [grid, setGrid])
    });

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        // 深拷貝防線 (The Deep Copy Mandate)
        initialGridRef.current = structuredClone(grid);
        e.currentTarget.select();
    }, [grid]);

    const handleBlur = useCallback(() => {
        const initial = initialGridRef.current;
        if (initial && !isRestoring) {
            // Check if grid actually changed (Zero-Delta Filter)
            const changed = JSON.stringify(initial) !== JSON.stringify(grid);
            if (changed) {
                pushHistory({
                    id: `edit_matrix_${id}_${Date.now()}`,
                    description: `Edit Matrix ${rows}×${cols}`,
                    forward: [{ type: 'UPDATE_NODE_DATA', payload: { id, data: { array: grid } } }],
                    inverse: [{ type: 'UPDATE_NODE_DATA', payload: { id, data: { array: initial } } }]
                });
            }
        }
        initialGridRef.current = null;
    }, [id, grid, rows, cols, pushHistory, isRestoring]);


    const updateCell = useCallback((r: number, c: number, val: string) => {
        if (val === '') {
            const newGrid = grid.map((row, ri) =>
                ri === r ? row.map((col, ci) => ci === c ? 0 : col) : row
            );
            setGrid(newGrid);
            return;
        }

        const num = parseFloat(val);
        if (!isNaN(num)) {
            const newGrid = grid.map((row, ri) =>
                ri === r ? row.map((col, ci) => ci === c ? num : col) : row
            );
            setGrid(newGrid);
        } else {
            // Keep the raw string for UI error state, but engine will see 0 if we were to sync now
            // Actually, let's keep it as is, but UI will highlight it.
            const newGrid = grid.map((row, ri) =>
                ri === r ? row.map((col, ci) => ci === c ? val : col) : row
            );
            setGrid(newGrid);
        }
    }, [grid, setGrid]);

    // Define Output Handle
    const handles = [
        { id: 'out_a', type: 'source', position: 'right' as any, variant: 'single' as any, dataType: 'array' as any }
    ];

    const nodeData = {
        ...data,
        handles,
        width,
        height,
        label: data.label || 'Array'
    };

    return (
        <BaseNode {...props} ref={nodeRef} data={nodeData} style={{ width, height }}>
            <div className="p-0 relative group overflow-visible">
                {/* Grid Container */}
                <div className="flex flex-col gap-1 w-fit relative">
                    {grid.map((row, r) => (
                        <div key={r} className="flex gap-1">
                                {row.map((val, c) => {
                                    const strVal = String(val);
                                    const isShort = strVal.length <= 5;
                                    const valParsed = parseFloat(strVal);
                                    const isLeadingToken = strVal === '-' || strVal === '.' || strVal === '-.' || strVal === '+';
                                    const isValid = !isNaN(valParsed) || strVal === '' || isLeadingToken;

                                    return (
                                        <div
                                            key={c}
                                            className="w-10 h-8 bg-zinc-900/50 border border-zinc-800 rounded flex items-center justify-center transition-colors"
                                        >
                                            <NumericInput
                                                value={typeof val === 'number' ? val : parseFloat(String(val)) || 0}
                                                onChange={(newVal) => updateCell(r, r, String(newVal))}
                                                onFocus={handleFocus}
                                                onBlur={handleBlur}
                                                hideLabel={true}
                                                inputClassName={`w-full h-full text-[10px] bg-transparent border-none text-zinc-300 text-center`}
                                            />
                                        </div>
                                    );
                                })}
                        </div>
                    ))}
                </div>
            </div>

            <ResizeHandle
                id={id}
                targetRef={nodeRef}
                position="bottom-right"
                onResize={onResize}
                onResizeStart={onResizeStart}
                onResizeEnd={onResizeEnd}
            />
        </BaseNode>
    );
});

ArrayInputNode.displayName = 'ArrayInputNode';

