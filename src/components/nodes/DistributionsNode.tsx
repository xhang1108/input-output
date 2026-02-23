import { memo, useCallback, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const DistributionsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const mode = (data.mode as string) || 'Normal';
    const n = data.n !== undefined ? Number(data.n) : 100;
    const p1 = data.p1 !== undefined ? Number(data.p1) : 0;
    const p2 = data.p2 !== undefined ? Number(data.p2) : 1;

    const updateData = useCallback((updates: Partial<typeof data>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: updates }
        });
    }, [id]);

    const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMode = e.target.value;
        let p1Label = 'Param 1';
        let p2Label = 'Param 2';

        if (newMode === 'Normal') {
            p1Label = 'μ (Mean)';
            p2Label = 'σ (StdDev)';
        } else if (newMode === 'Uniform') {
            p1Label = 'Min';
            p2Label = 'Max';
        } else if (newMode === 'Poisson') {
            p1Label = 'λ (Lambda)';
            p2Label = ''; // Not used
        }

        const newHandles = [
            { id: 'param_n', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' },
            { id: 'param_1', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' }
        ];

        // Add 2nd parameter handle if needed
        if (newMode !== 'Poisson') {
            newHandles.push({ id: 'param_2', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' });
        }

        newHandles.push({ id: 'samples', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix' });

        updateData({ mode: newMode, handles: newHandles });
    };

    // Ensure valid current handles are passed via node data so that BaseNode renders them
    let p1Label = 'Param 1';
    let p2Label = 'Param 2';
    if (mode === 'Normal') { p1Label = 'μ'; p2Label = 'σ'; }
    else if (mode === 'Uniform') { p1Label = 'Min'; p2Label = 'Max'; }
    else if (mode === 'Poisson') { p1Label = 'λ'; }

    let handles = [
        { id: 'param_n', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' },
        { id: 'param_1', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' }
    ];
    if (mode !== 'Poisson') {
        handles.push({ id: 'param_2', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' });
    }
    handles.push({ id: 'samples', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix' });

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[140px]">
                <select
                    className="nodrag w-full border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={mode}
                    onChange={handleModeChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="Normal">Normal (Gaussian)</option>
                    <option value="Uniform">Uniform</option>
                    <option value="Poisson">Poisson</option>
                </select>

                <div className="flex flex-col gap-1 border border-zinc-700/30 rounded p-1 bg-black/10">
                    {/* We provide simple text inputs for default values so they can be overridden without attaching cables */}
                    <div className="flex items-center justify-between">
                        <label className="text-[9px] text-zinc-500 uppercase font-bold w-1/3 text-right pr-2">N</label>
                        <input
                            type="number"
                            className="nodrag w-2/3 border border-zinc-700/50 rounded px-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none transition-colors"
                            style={{ background: 'var(--node-bg-header)' }}
                            value={n}
                            onChange={(e) => updateData({ n: Number(e.target.value) })}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="text-[9px] text-zinc-500 uppercase font-bold w-1/3 text-right pr-2">{p1Label}</label>
                        <input
                            type="number"
                            className="nodrag w-2/3 border border-zinc-700/50 rounded px-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none transition-colors"
                            style={{ background: 'var(--node-bg-header)' }}
                            value={p1}
                            onChange={(e) => updateData({ p1: Number(e.target.value) })}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                    {mode !== 'Poisson' && (
                        <div className="flex items-center justify-between">
                            <label className="text-[9px] text-zinc-500 uppercase font-bold w-1/3 text-right pr-2">{p2Label}</label>
                            <input
                                type="number"
                                className="nodrag w-2/3 border border-zinc-700/50 rounded px-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none transition-colors"
                                style={{ background: 'var(--node-bg-header)' }}
                                value={p2}
                                onChange={(e) => updateData({ p2: Number(e.target.value) })}
                                onMouseDown={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                </div>
            </div>
        </BaseNode>
    );
});

DistributionsNode.displayName = 'DistributionsNode';
