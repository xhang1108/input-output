
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const DIST_ITEMS: CategorizedMenuItem[] = [
    { id: 'Normal', label: 'Normal (Gaussian)', category: 'Continuous', aliases: ['gaussian', 'normal'] },
    { id: 'Uniform', label: 'Uniform', category: 'Continuous', aliases: ['uniform', 'rect'] },
    { id: 'Poisson', label: 'Poisson', category: 'Discrete', aliases: ['poisson', 'discrete'] },
];

export const DistributionsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
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

    const handleMenuSelect = (item: CategorizedMenuItem) => {
        const newMode = item.id;
        updateData({
            mode: newMode, handles: [
                { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'array' }
            ]
        });
        closeMenu();
    };


    let p1Label = 'Param 1';
    let p2Label = 'Param 2';
    if (mode === 'Normal') { p1Label = 'μ (Mean)'; p2Label = 'σ (StdDev)'; }
    else if (mode === 'Uniform') { p1Label = 'Min'; p2Label = 'Max'; }
    else if (mode === 'Poisson') { p1Label = 'λ (Lambda)'; }

    const nodeData = {
        ...data,
        handles: [
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'array' }
        ]
    };

    const currentModeLabel = DIST_ITEMS.find(d => d.id === mode)?.label || mode;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[150px]">
                <button
                    className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-md px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                    onClick={handleTrigger}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="truncate font-medium group-hover:text-white">{currentModeLabel}</span>
                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={DIST_ITEMS}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleMenuSelect}
                    placeholder="Search Distribution..."
                    width="48"
                />

                <div className="flex flex-col gap-1.5 border border-zinc-800/50 rounded bg-black/10 p-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <label className="text-[9px] text-zinc-500 uppercase font-black w-8 text-right">N</label>
                        <input
                            type="number"
                            className="nodrag flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-blue-500/50 transition-colors"
                            value={n}
                            onChange={(e) => updateData({ n: Number(e.target.value) })}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <label className="text-[9px] text-zinc-500 uppercase font-black w-8 text-right">{mode === 'Normal' ? 'μ' : mode === 'Uniform' ? 'MIN' : 'λ'}</label>
                        <input
                            type="number"
                            className="nodrag flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-blue-500/50 transition-colors"
                            value={p1}
                            onChange={(e) => updateData({ p1: Number(e.target.value) })}
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </div>
                    {mode !== 'Poisson' && (
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-[9px] text-zinc-500 uppercase font-black w-8 text-right">{mode === 'Normal' ? 'σ' : 'MAX'}</label>
                            <input
                                type="number"
                                className="nodrag flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-blue-500/50 transition-colors"
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
