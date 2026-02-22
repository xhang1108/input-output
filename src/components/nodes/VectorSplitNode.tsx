import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const VectorSplitNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const mode = (data.mode as string) || 'separate'; // 'separate' | 'combine'

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMode = e.target.value;
        const newHandles = newMode === 'separate' ? [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector' },
            { id: 'x', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'X' },
            { id: 'y', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Y' },
            { id: 'z', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Z' }
        ] : [
            { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'scalar', label: 'Split' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'vector' }
        ];

        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: {
                    mode: newMode,
                    handles: newHandles
                }
            }
        });
    }, [id]);

    let handles: any[] = [];

    if (mode === 'separate') {
        handles = [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector' },
            { id: 'x', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'X' },
            { id: 'y', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Y' },
            { id: 'z', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Z' }
        ];
    } else {
        handles = [
            { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'scalar', label: 'Split' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'vector' }
        ];
    }

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Mode</label>
                <select
                    className="nodrag w-full border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:border-(--color-math) outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={mode}
                    onChange={handleChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="separate">Split Vector</option>
                    <option value="combine">Combine Vector</option>
                </select>
            </div>
        </BaseNode>
    );
});
VectorSplitNode.displayName = 'VectorSplitNode';
