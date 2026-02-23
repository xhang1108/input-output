import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const VectorFieldNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const mode = (data.mode as string) || 'gradient';
    const var1 = (data.var1 as string) || 'x';
    const var2 = (data.var2 as string) || 'y';
    const min = data.min !== undefined ? Number(data.min) : -5;
    const max = data.max !== undefined ? Number(data.max) : 5;
    const density = data.density !== undefined ? Number(data.density) : 10;

    const updateData = useCallback((updates: Partial<typeof data>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: updates
            }
        });
    }, [id]);

    const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMode = e.target.value;
        const newHandles = newMode === 'gradient' ? [
            { id: 'in_f', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: 'f(x,y)' },
            { id: 'out_field', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'Grid' },
            { id: 'out_grad', type: 'source', position: Position.Right, variant: 'single', dataType: 'vector', label: '∇f' }
        ] : [
            { id: 'in_f', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: 'V(x,y)' },
            { id: 'out_field', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'Grid' }
        ];

        updateData({ mode: newMode, handles: newHandles });
    };

    let handles: any[] = [];
    if (mode === 'gradient') {
        handles = [
            { id: 'in_f', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: 'f(x,y)' },
            { id: 'out_field', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'Grid' },
            { id: 'out_grad', type: 'source', position: Position.Right, variant: 'single', dataType: 'vector', label: '∇f' }
        ];
    } else {
        handles = [
            { id: 'in_f', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: 'V(x,y)' },
            { id: 'out_field', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'Grid' }
        ];
    }

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[140px]">

                <select
                    className="nodrag w-full border border-zinc-700/50 rounded flex-1 px-2 py-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={mode}
                    onChange={handleModeChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="gradient">Gradient (Scalar)</option>
                    <option value="direct">Direct (Vector)</option>
                </select>

                <div className="flex gap-2">
                    <div className="flex flex-col w-1/2">
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Var 1</label>
                        <input
                            className="nodrag w-full border border-zinc-700/50 rounded flex-1 px-2 py-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none transition-colors"
                            style={{ background: 'var(--node-bg-header)' }}
                            value={var1}
                            onChange={(e) => updateData({ var1: e.target.value })}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex flex-col w-1/2">
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Var 2</label>
                        <input
                            className="nodrag w-full border border-zinc-700/50 rounded flex-1 px-2 py-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none transition-colors"
                            style={{ background: 'var(--node-bg-header)' }}
                            value={var2}
                            onChange={(e) => updateData({ var2: e.target.value })}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex flex-col w-1/2">
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Min</label>
                        <input
                            type="number"
                            className="nodrag w-full border border-zinc-700/50 rounded flex-1 px-2 py-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none transition-colors"
                            style={{ background: 'var(--node-bg-header)' }}
                            value={min}
                            onChange={(e) => updateData({ min: Number(e.target.value) })}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex flex-col w-1/2">
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Max</label>
                        <input
                            type="number"
                            className="nodrag w-full border border-zinc-700/50 rounded flex-1 px-2 py-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none transition-colors"
                            style={{ background: 'var(--node-bg-header)' }}
                            value={max}
                            onChange={(e) => updateData({ max: Number(e.target.value) })}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>

                <div className="flex flex-col text-xs text-zinc-400 mt-1">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Grid Steps: {density}</label>
                    </div>
                    <input
                        type="range"
                        className="nodrag accent-blue-500 cursor-pointer"
                        min={2}
                        max={30}
                        step={1}
                        value={density}
                        onChange={(e) => updateData({ density: Number(e.target.value) })}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                </div>
            </div>
        </BaseNode>
    );
});
VectorFieldNode.displayName = 'VectorFieldNode';
