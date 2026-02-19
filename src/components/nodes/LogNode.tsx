
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const LogNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const [op, setOp] = useState<string>((data.op as string) || 'LN');

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newOp = e.target.value;
        setOp(newOp);

        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { op: newOp }
            }
        });
    }, [id]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Base Mode</label>
                <select
                    className="nodrag w-full border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:border-blue-500 outline-none appearance-none"
                    style={{ background: 'var(--node-bg)' }}
                    value={op}
                    onChange={handleChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="LN">Ln (Base e)</option>
                    <option value="LOG10">Log 10</option>
                    <option value="LOG_N">Log Base N</option>
                </select>
            </div>
        </BaseNode>
    );
});
LogNode.displayName = 'LogNode';
