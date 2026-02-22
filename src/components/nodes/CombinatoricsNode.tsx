import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const CombinatoricsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const op = (data.op as string) || 'nCr';

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: e.target.value } }
        });
    }, [id]);

    const handles: any[] = [
        { id: 'n', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'n' }
    ];

    if (op !== 'n!') {
        handles.push({ id: 'r', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'r' });
    }

    handles.push({ id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' });

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Operation</label>
                <select
                    className="nodrag w-full border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:border-(--color-math) outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={op}
                    onChange={handleChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="nCr">Combinations (nCr)</option>
                    <option value="nPr">Permutations (nPr)</option>
                    <option value="n!">Factorial (n!)</option>
                </select>
            </div>
        </BaseNode>
    );
});
CombinatoricsNode.displayName = 'CombinatoricsNode';
