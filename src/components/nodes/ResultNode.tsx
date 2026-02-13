import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const ResultNode = memo((props: NodeProps) => {
    const { id, data } = props;

    // Brain updates node.value with calculation result (NodePayload)
    // Phase 2.1: Unwrap payload for basic scalar display
    const payload = data.value as import('../../types/payload').NodePayload;

    let displayValue = '...';
    let isError = false;

    if (payload) {
        if (payload.type === 'error') {
            displayValue = payload.meta?.error || 'Error';
            isError = true;
        } else {
            const rawValue = PayloadUtils.unwrap(payload);
            if (rawValue !== undefined && rawValue !== null) {
                // Handle BigNumber or other objects if they leak through
                if (typeof rawValue === 'object' && 'toString' in rawValue) {
                    displayValue = rawValue.toString();
                } else {
                    displayValue = String(rawValue);
                }
            }
        }
    }

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Result</label>
                <div
                    className={`w-full border border-zinc-800 rounded px-2 py-2 text-xl font-mono text-right overflow-hidden ${isError ? 'text-red-500 text-sm' : ''}`}
                    style={{ background: 'var(--node-bg)', color: isError ? 'red' : 'var(--color-vector)' }}
                >
                    {displayValue}
                </div>
            </div>
        </BaseNode>
    );
});
ResultNode.displayName = 'ResultNode';
