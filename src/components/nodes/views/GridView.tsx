import React from 'react';
import { DisplayUtils } from '../../../utils/DisplayUtils';

interface GridViewProps {
    grid: unknown[][];
    precision: number;
}

export const GridView: React.FC<GridViewProps> = ({ grid, precision }) => {
    if (!grid || !grid.length) return <span className="text-xs text-zinc-500">Empty Matrix</span>;

    const rows = grid.length;
    const cols = Array.isArray(grid[0]) ? grid[0].length : 0;

    return (
        <div className="flex flex-col gap-1 items-center justify-center p-1 font-mono text-zinc-200">
            <div className="flex flex-col gap-1 w-full max-w-[240px] overflow-x-auto custom-scrollbar">
                {grid.slice(0, 10).map((row, r) => (
                    <div key={r} className="flex gap-1 w-max">
                        {Array.isArray(row) ? row.slice(0, 10).map((val, c) => {
                            const displayVal = DisplayUtils.formatValue(val, precision);
                            const isShort = displayVal.length <= 5;
                            return (
                                <div
                                    key={c}
                                    className={`w-12 h-8 flex shrink-0 items-center ${isShort ? 'justify-center' : 'justify-start'} text-[10px] 
                                             bg-zinc-800/50 border border-zinc-700/50 rounded-sm overflow-hidden px-1`}
                                    title={DisplayUtils.formatValue(val, -1)}
                                >
                                    <span className={`truncate w-full ${isShort ? 'text-center' : 'text-left'}`}>
                                        {displayVal}
                                    </span>
                                </div>
                            );
                        }) : (
                            (() => {
                                const displayVal = DisplayUtils.formatValue(row, precision);
                                const isShort = displayVal.length <= 5;
                                return (
                                    <div className={`w-12 h-8 flex shrink-0 items-center ${isShort ? 'justify-center' : 'justify-start'} text-[10px] bg-zinc-800/50 border border-zinc-700/50 rounded-sm overflow-hidden px-1`}>
                                        <span className={`truncate w-full ${isShort ? 'text-center' : 'text-left'}`}>
                                            {displayVal}
                                        </span>
                                    </div>
                                );
                            })()
                        )}
                    </div>
                ))}
            </div>

            {(rows > 10 || cols > 10) && (
                <div className="text-[8px] text-zinc-600 italic whitespace-nowrap mt-1">Showing 10x10</div>
            )}

            <div className="text-[10px] text-zinc-500 mt-1 border-t border-zinc-800/50 pt-1 w-full text-center">
                {rows} × {cols}
            </div>
        </div>
    );
};
