import React, { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';

export const IntegralNode = memo((props: NodeProps) => {
    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 relative items-center justify-center min-w-[80px]">
                <div className="text-[18px] font-mono text-zinc-300 leading-none">
                    ∫
                </div>
                <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Integral</div>
            </div>
        </BaseNode>
    );
});

IntegralNode.displayName = 'IntegralNode';
