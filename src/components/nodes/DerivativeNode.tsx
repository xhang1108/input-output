import React, { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';

export const DerivativeNode = memo((props: NodeProps) => {
    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 relative items-center justify-center min-w-[80px]">
                <div className="text-[14px] font-mono text-zinc-300 tracking-wider">
                    d/d<span className="italic text-zinc-400">x</span>
                </div>
                <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Derivative</div>
            </div>
        </BaseNode>
    );
});

DerivativeNode.displayName = 'DerivativeNode';
