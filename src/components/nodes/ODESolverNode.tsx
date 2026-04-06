
import { memo, useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';
import { NumericInput } from '../common/NumericInput';

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

                <div className="w-full flex flex-col gap-2">
                    {/* Method Selector */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Method</span>
                        <button
                            className="nodrag w-full bg-zinc-900 border border-zinc-700/50 rounded-md px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group h-6"
                            onClick={handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="truncate">{method}</span>
                            <svg className="w-2 h-2 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Parameters Grid */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">t₀</span>
                            <NumericInput 
                                value={t0}
                                onChange={(val) => updateNodeData(id, { t0: val })}
                                hideLabel={true}
                                inputClassName="h-6 text-[10px] px-1 text-center"
                                className="w-full"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">tₑₙ</span>
                            <NumericInput 
                                value={tEnd}
                                onChange={(val) => updateNodeData(id, { tEnd: val })}
                                hideLabel={true}
                                inputClassName="h-6 text-[10px] px-1 text-center"
                                className="w-full"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">y₀</span>
                            <NumericInput 
                                value={y0}
                                onChange={(val) => updateNodeData(id, { y0: val })}
                                hideLabel={true}
                                inputClassName="h-6 text-[10px] px-1 text-center"
                                className="w-full"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">h</span>
                            <NumericInput 
                                value={stepSize}
                                onChange={(val) => updateNodeData(id, { stepSize: val })}
                                hideLabel={true}
                                inputClassName="h-6 text-[10px] px-1 text-center"
                                className="w-full"
                                precision={4}
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

