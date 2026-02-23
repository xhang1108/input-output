import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const StatisticsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const op = (data.op as string) || 'Mean';

    const handleOpChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newOp = e.target.value;
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: newOp } }
        });
    }, [id]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <select
                    className="nodrag w-full border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={op}
                    onChange={handleOpChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="Mean">Mean</option>
                    <option value="Max">Max</option>
                    <option value="Min">Min</option>
                    <option value="StdDev">StdDev</option>
                    <option value="Median">Median</option>
                    <option value="Variance">Variance</option>
                    <option value="Sum">Sum</option>
                </select>
            </div>
        </BaseNode>
    );
});

StatisticsNode.displayName = 'StatisticsNode';
