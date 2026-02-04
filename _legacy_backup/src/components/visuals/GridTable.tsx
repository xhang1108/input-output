'use client';

import { memo } from 'react';
import * as math from 'mathjs';

interface GridTableProps {
    data: any;
    maxRows?: number;
    maxCols?: number;
}

/**
 * A generic grid table component for displaying 2D data (matrices, arrays, etc.)
 */
export const GridTable = memo(({ data, maxRows = 20, maxCols = 10 }: GridTableProps) => {
    // Normalize data to array
    let rawData = data;
    if (data?.toArray) {
        rawData = data.toArray();
    } else if (data?.data && Array.isArray(data.data)) {
        rawData = data.data;
    } else if (data?._data && Array.isArray(data._data)) {
        rawData = data._data;
    }
    if (!Array.isArray(rawData)) return null;

    const rowsToRender = rawData.slice(0, maxRows);
    const totalRows = rawData.length;

    return (
        <div className="w-full max-h-[300px] overflow-auto scrollbar-thin scrollbar-thumb-zinc-300 p-1">
            <div className="flex flex-col gap-1 w-fit">
                {rowsToRender.map((row: any, i: number) => {
                    const cells = Array.isArray(row) ? row : [row];

                    return (
                        <div key={i} className="flex gap-1">
                            {cells.slice(0, maxCols).map((cell: any, j: number) => (
                                <div
                                    key={j}
                                    className="w-10 h-8 flex items-center justify-center text-sm font-bold font-mono bg-zinc-50 border border-zinc-200 rounded-sm text-zinc-900 overflow-hidden"
                                    title={String(cell)}
                                >
                                    {typeof cell === 'number' ? math.format(cell, { precision: 4 }) : String(cell)}
                                </div>
                            ))}

                            {cells.length > maxCols && (
                                <div className="w-8 h-8 flex items-center justify-center text-zinc-400 italic text-xs">...</div>
                            )}
                        </div>
                    );
                })}

                {totalRows > maxRows && (
                    <div className="text-center text-zinc-400 italic text-xs py-1">
                        ... {totalRows - maxRows} more ...
                    </div>
                )}
            </div>
        </div>
    );
});

GridTable.displayName = 'GridTable';
