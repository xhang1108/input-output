import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const ArrayBuilderNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const axis = (data.axis as number) ?? 0;
    const count = (data.count as number) || 2;

    const handleAxisChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { axis: parseInt(e.target.value) } }
        });
    }, [id]);

    const handles: any[] = [
        { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'any' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix' }
    ];

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <div className="flex justify-between items-center px-1 pb-1">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Concat Axis</label>
                </div>
                <select
                    className="nodrag w-full border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:border-(--color-math) outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={axis}
                    onChange={handleAxisChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value={0}>Axis 0 (Rows)</option>
                    <option value={1}>Axis 1 (Cols)</option>
                </select>
            </div>
        </BaseNode>
    );
});
ArrayBuilderNode.displayName = 'ArrayBuilderNode';
