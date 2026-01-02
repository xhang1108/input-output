'use client';

import { Handle, Position } from '@xyflow/react';

interface NodeOutputProps {
    data: { value?: number };
}

export function NodeOutput({ data }: NodeOutputProps) {
    const displayValue =
        data.value !== undefined
            ? Number(data.value).toFixed(2).replace(/\.?0+$/, '')
            : '—';

    return (
        <div className="bg-zinc-200 border-2 border-green-500 rounded-xl p-4 shadow-[0_0_15px_rgba(34,197,94,0.3)] min-w-[180px] group transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] hover:border-green-400">
            <Handle
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !bg-green-500 !border-2 !border-zinc-200"
            />

            <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                    Result
                </div>
                <div className="text-3xl font-mono font-bold text-zinc-400 tabular-nums">
                    {displayValue}
                </div>
            </div>
        </div>
    );
}
