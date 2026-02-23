import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const ComplexNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const mode = (data.mode as string) || 'separate'; // 'separate' | 'combine_cartesian' | 'combine_polar'

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMode = e.target.value;
        let newHandles: any[] = [];

        if (newMode === 'separate') {
            newHandles = [
                { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: 'In' },
                { id: 're', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Re' },
                { id: 'im', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Im' },
                { id: 'abs', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Abs(r)' },
                { id: 'arg', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Arg(φ)' }
            ];
        } else if (newMode === 'combine_cartesian') {
            newHandles = [
                { id: 'in_re', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Re' },
                { id: 'in_im', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Im' },
                { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'any', label: 'Out' }
            ];
        } else if (newMode === 'combine_polar') {
            newHandles = [
                { id: 'in_abs', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Abs(r)' },
                { id: 'in_arg', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Arg(φ)' },
                { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'any', label: 'Out' }
            ];
        }

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
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: 'In' },
            { id: 're', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Re' },
            { id: 'im', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Im' },
            { id: 'abs', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Abs(r)' },
            { id: 'arg', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Arg(φ)' }
        ];
    } else if (mode === 'combine_cartesian') {
        handles = [
            { id: 'in_re', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Re' },
            { id: 'in_im', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Im' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'any', label: 'Out' }
        ];
    } else if (mode === 'combine_polar') {
        handles = [
            { id: 'in_abs', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Abs(r)' },
            { id: 'in_arg', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Arg(φ)' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'any', label: 'Out' }
        ];
    }

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Mode</label>
                <select
                    className="nodrag w-full border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:border-blue-500/50 outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={mode}
                    onChange={handleChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="separate">Extract Parts</option>
                    <option value="combine_cartesian">Combine (a + bi)</option>
                    <option value="combine_polar">Combine (r e^iφ)</option>
                </select>
            </div>
        </BaseNode>
    );
});
ComplexNode.displayName = 'ComplexNode';
