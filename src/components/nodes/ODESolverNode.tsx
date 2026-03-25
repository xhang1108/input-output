
import { memo, useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const METHOD_ITEMS: CategorizedMenuItem[] = [
    { id: 'RK4', label: 'RK4 (Runge-Kutta)', category: 'Higher Order' },
    { id: 'Euler', label: 'Euler Method', category: 'First Order' },
];

export const ODESolverNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const { updateNodeData } = useReactFlow();

    const method = (data.method as string) || 'RK4';
    const t0 = data.t0 !== undefined ? Number(data.t0) : 0;
    const tEnd = data.tEnd !== undefined ? Number(data.tEnd) : 10;
    const y0 = data.y0 !== undefined ? Number(data.y0) : 1;
    const stepSize = data.stepSize !== undefined ? Number(data.stepSize) : 0.01;

    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        updateNodeData(id, { method: item.id });
        closeMenu();
    }, [id, updateNodeData, closeMenu]);


    const currentLabel = METHOD_ITEMS.find(i => i.id === method)?.label || method;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[140px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    ODE Solver
                </div>

                <div className="w-full flex flex-col gap-1.5">
                    {/* Method Selector */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8">Mth</span>
                        <button
                            className="nodrag flex-1 bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group"
                            onClick={handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="truncate">{method}</span>
                            <svg className="w-2.5 h-2.5 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Parameters */}
                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter">t₀</span>
                            <input
                                type="number"
                                value={t0}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateNodeData(id, { t0: Number(e.target.value) })}
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-full text-center focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter">tₑₙ</span>
                            <input
                                type="number"
                                value={tEnd}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateNodeData(id, { tEnd: Number(e.target.value) })}
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-full text-center focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter">y₀</span>
                            <input
                                type="number"
                                value={y0}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateNodeData(id, { y0: Number(e.target.value) })}
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-full text-center focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter">h</span>
                            <input
                                type="number"
                                step="0.001"
                                value={stepSize}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateNodeData(id, { stepSize: Number(e.target.value) })}
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-full text-center focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                    </div>
                </div>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={METHOD_ITEMS}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleSelect}
                    placeholder="Search Method..."
                    width="40"
                />
            </div>
        </BaseNode>
    );
});

ODESolverNode.displayName = 'ODESolverNode';
