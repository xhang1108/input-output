import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const InputNode = memo((props: NodeProps) => {
    const { id, data } = props;

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            Brain.getInstance().applyTransaction({
                type: 'UPDATE_VALUE',
                payload: { id, value: val } // Brain will wrap this
            });
        }
    }, [id]);

    const displayValue = Number(PayloadUtils.unwrap(data.value)) || 0;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Value</label>
                <input
                    type="number"
                    className="nodrag w-full border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:border-blue-500 outline-none"
                    style={{ background: 'var(--node-bg)' }}
                    placeholder="0.0"
                    defaultValue={displayValue}
                    onChange={handleChange}
                    onMouseDown={(e) => e.stopPropagation()}
                />
            </div>
        </BaseNode>
    );
});
InputNode.displayName = 'InputNode';
