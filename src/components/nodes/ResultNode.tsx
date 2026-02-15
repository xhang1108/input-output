import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { Brain } from '../../engine/Brain';

// We need to detect matrix structure from payload.value
// Typically it's a dehydrated object { mathjs: 'Matrix', data: [...] } or a raw array.

export const ResultNode = memo((props: NodeProps) => {
    const { id, data } = props;

    // Define custom handles: Single Input (Dot), No Output (Sink)
    const handles = [
        {
            id: 'in',
            type: 'target',
            position: 'left',
            variant: 'single'
        }
    ];

    // Merge handles into data
    const nodeData = { ...data, handles };

    const precision = data.precision as number | undefined;
    const payload = data.value as import('../../types/payload').NodePayload;

    let displayValue: React.ReactNode = '...';
    let isError = false;
    let isMatrix = false;
    let matrixData: any[][] = [];

    if (payload) {
        if (payload.type === 'error') {
            displayValue = payload.meta?.error || 'Error';
            isError = true;
        } else {
            // Check for Matrix Type explicitly or by value structure
            // 1. Check DataType enum (if we had it imported, but string check is fine)
            if (payload.type === 'matrix') {
                isMatrix = true;
            }

            // 2. Unwrap to get raw value
            const rawValue = PayloadUtils.unwrap(payload);

            if (isMatrix) {
                // Handle Matrix Rendering
                // rawValue could be Array[][] or { mathjs: 'Matrix', data: ... }
                if (Array.isArray(rawValue)) {
                    matrixData = rawValue;
                } else if (typeof rawValue === 'object' && rawValue?.mathjs === 'Matrix') {
                    matrixData = rawValue.data;
                } else {
                    // Fallback or single value matrix
                    isMatrix = false; // Treat as scalar if we can't parse grid
                }
            }

            if (!isMatrix) {
                // --- SCALAR RENDERING (Existing Logic) ---
                if (rawValue !== undefined && rawValue !== null) {
                    let numValue: number | null = null;
                    let unitStr: string | undefined = payload.meta?.unit;

                    // Extract numeric value and potential unit from dehydrated objects
                    if (typeof rawValue === 'object' && rawValue !== null && 'mathjs' in rawValue) {
                        if ('value' in rawValue) {
                            numValue = Number(rawValue.value);
                        }
                        if ('unit' in rawValue) {
                            unitStr = (rawValue as any).unit;
                        }
                    } else if (typeof rawValue === 'number') {
                        numValue = rawValue;
                    }

                    if (numValue !== null && !isNaN(numValue)) {
                        if (precision !== undefined && precision !== -1) {
                            displayValue = numValue.toLocaleString(undefined, {
                                minimumFractionDigits: precision,
                                maximumFractionDigits: precision
                            });
                        } else {
                            // Intelligent default
                            const absVal = Math.abs(numValue);
                            if (absVal !== 0 && (absVal < 0.0001 || absVal > 100000000)) {
                                displayValue = numValue.toExponential(4);
                            } else {
                                displayValue = numValue.toLocaleString(undefined, {
                                    maximumFractionDigits: 6
                                });
                            }
                        }
                    } else if (typeof rawValue === 'object' && 'toString' in rawValue) {
                        displayValue = rawValue.toString();
                    } else {
                        displayValue = String(rawValue);
                    }

                    // Handle units
                    const finalUnit = unitStr || payload.meta?.unit;
                    if (finalUnit) {
                        const formatUnit = (u: string) => {
                            return u
                                .replace(/ /g, '')
                                .replace(/\*/g, '')
                                .replace(/m{2}/g, 'm²')
                                .replace(/\^2/g, '²')
                                .replace(/\^3/g, '³')
                                .replace(/\^([0-9]+)/g, '^$1');
                        };

                        displayValue = (
                            <div className="flex flex-col items-end">
                                <div className="flex items-baseline gap-1.5 leading-none">
                                    <span className={`font-mono transition-all duration-200 ${isError ? 'text-red-500 text-sm' : 'text-2xl text-(--color-scalar)'}`}>
                                        {displayValue}
                                    </span>
                                    <span className="text-xs font-bold text-zinc-500 italic">
                                        {formatUnit(finalUnit)}
                                    </span>
                                </div>
                            </div>
                        );
                    }
                }
            }
        }
    }

    const renderEmpty = () => (
        <div className="text-2xl font-mono text-zinc-800 text-right opacity-20 select-none">
            000.00
        </div>
    );

    const handlePrecisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const p = parseInt(e.target.value);
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { precision: p } }
        });
    };

    // Render Matrix Grid
    const renderMatrix = (grid: any[][]) => {
        if (!grid || !grid.length) return <span className="text-xs text-zinc-500">Empty Matrix</span>;

        // Limit display size for performance
        const maxRows = 8;
        const maxCols = 8;
        const totalRows = grid.length;
        const totalCols = grid[0]?.length || 0;

        const displayRows = grid.slice(0, maxRows);

        return (
            <div className="flex flex-col gap-1">
                <div className="flex flex-col gap-px bg-zinc-800/50 border border-zinc-800 rounded overflow-hidden">
                    {displayRows.map((row, r) => (
                        <div key={r} className="flex gap-px">
                            {Array.isArray(row) ? row.slice(0, maxCols).map((cell, c) => (
                                <div key={c} className="w-8 h-6 flex items-center justify-center bg-zinc-900/80 text-[10px] font-mono text-cyan-300">
                                    {typeof cell === 'number'
                                        ? cell.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                        : String(cell)}
                                </div>
                            )) : (
                                <div className="w-full px-2 py-1 text-xs text-red-400">Invalid Row</div>
                            )}
                            {totalCols > maxCols && (
                                <div className="w-4 h-6 flex items-center justify-center bg-zinc-900/80 text-[8px] text-zinc-600">...</div>
                            )}
                        </div>
                    ))}
                    {totalRows > maxRows && (
                        <div className="w-full h-4 flex items-center justify-center bg-zinc-900/80 text-[8px] text-zinc-500">
                            {totalRows - maxRows} more rows...
                        </div>
                    )}
                </div>
                <div className="text-[9px] text-zinc-500 text-right px-1">
                    {totalRows} × {totalCols}
                </div>
            </div>
        );
    };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[140px]">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Result</label>
                    {!isMatrix && (
                        <select
                            className="nodrag bg-transparent text-[9px] text-zinc-600 border-none outline-none cursor-pointer hover:text-zinc-400"
                            value={precision ?? -1}
                            onChange={handlePrecisionChange}
                        >
                            <option value={-1}>Auto</option>
                            {[0, 1, 2, 3, 4, 5, 6, 8, 10].map(p => (
                                <option key={p} value={p}>{p} d.p.</option>
                            ))}
                        </select>
                    )}
                </div>

                {isMatrix ? (
                    <div className="w-full flex justify-center py-1">
                        {renderMatrix(matrixData)}
                    </div>
                ) : (
                    <div
                        className={`w-full min-h-[44px] flex items-center justify-end border border-zinc-800/50 rounded-lg px-3 py-2 bg-black/20 group-hover:border-zinc-700/50 transition-colors ${isError ? 'border-red-900/30' : ''}`}
                    >
                        {displayValue === '...' ? renderEmpty() : (typeof displayValue === 'string' ? (
                            <span className={`font-mono truncate ${isError ? 'text-red-500 text-sm' : 'text-2xl text-(--color-scalar)'}`}>
                                {displayValue}
                            </span>
                        ) : displayValue)}
                    </div>
                )}
            </div>
        </BaseNode>
    );
});

ResultNode.displayName = 'ResultNode';
