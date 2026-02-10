'use client';

import { memo } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';

export const FrameNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div
            className={`
                relative bg-zinc-900/30 border-2 border-dashed rounded-lg transition duration-200 group -z-10
                ${selected ? 'border-zinc-400 bg-zinc-800/50' : 'border-zinc-800 hover:border-zinc-700'}
            `}
            style={{
                width: data.width ? Number(data.width) : 300,
                height: data.height ? Number(data.height) : 200,
            }}
        >
            {/* Header / Label */}
            <div className="absolute -top-7 left-0 px-2 py-1 bg-zinc-800/50 rounded text-xs font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-300 transition-colors">
                {String(data.label || 'Frame')}
            </div>

            {/* We don't need handles for now, or maybe later for data flow? */}
            {/* Frame is mainly structural. */}
        </div>
    );
});

FrameNode.displayName = 'FrameNode';
