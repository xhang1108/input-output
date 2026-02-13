
import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';

export const ResultNode = memo((props: NodeProps) => {
    const { id, data } = props;

    // Brain updates node.value with calculation result
    const displayValue = data.value !== undefined ? String(data.value) : '...';

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Result</label>
                <div
                    className="w-full border border-zinc-800 rounded px-2 py-2 text-xl font-mono text-right overflow-hidden"
                    style={{ background: 'var(--node-bg)', color: 'var(--color-vector)' }}
                >
                    {displayValue}
                </div>
            </div>
        </BaseNode>
    );
});
ResultNode.displayName = 'ResultNode';
