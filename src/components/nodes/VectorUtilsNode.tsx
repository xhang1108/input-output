import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const VectorUtilsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const op = (data.op as string) || 'DOT';

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: e.target.value } }
        });
    }, [id]);

    const handles: any[] = [
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector', label: 'A' }
    ];

    if (op !== 'NORM') {
        handles.push({ id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector', label: 'B' });
    }

    handles.push(
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
    );

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Vector Op</label>
                <select
                    className="nodrag w-full border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:border-(--color-math) outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={op}
                    onChange={handleChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="DOT">Dot Product</option>
                    <option value="CROSS">Cross Product</option>
                    <option value="NORM">Norm (Length)</option>
                    <option value="DISTANCE">Distance</option>
                </select>
            </div>
        </BaseNode>
    );
});
VectorUtilsNode.displayName = 'VectorUtilsNode';
