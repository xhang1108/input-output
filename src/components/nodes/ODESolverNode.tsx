import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';

export const ODESolverNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();

    const method = (data.method as string) || 'RK4';
    const t0 = data.t0 !== undefined ? Number(data.t0) : 0;
    const tEnd = data.tEnd !== undefined ? Number(data.tEnd) : 10;
    const y0 = data.y0 !== undefined ? Number(data.y0) : 1;
    const stepSize = data.stepSize !== undefined ? Number(data.stepSize) : 0.01;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[140px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    ODE Solver
                </div>

                <div className="w-full flex flex-col gap-1.5">
                    {/* Method */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8">Mth</span>
                        <select
                            value={method}
                            onChange={(e) => updateNodeData(id, { method: e.target.value })}
                            className="nodrag bg-zinc-900 text-zinc-300 text-[10px] flex-1 p-1 rounded border border-zinc-700 focus:outline-none focus:border-zinc-500"
                        >
                            <option value="RK4">RK4</option>
                            <option value="Euler">Euler</option>
                        </select>
                    </div>

                    {/* Parameters */}
                    <div className="grid grid-cols-2 gap-1">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] text-zinc-500 uppercase">t₀</span>
                            <input
                                type="number"
                                value={t0}
                                onChange={(e) => updateNodeData(id, { t0: Number(e.target.value) })}
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-0.5 rounded text-[10px] w-full text-center focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] text-zinc-500 uppercase">tₑₙ</span>
                            <input
                                type="number"
                                value={tEnd}
                                onChange={(e) => updateNodeData(id, { tEnd: Number(e.target.value) })}
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-0.5 rounded text-[10px] w-full text-center focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] text-zinc-500 uppercase">y₀</span>
                            <input
                                type="number"
                                value={y0}
                                onChange={(e) => updateNodeData(id, { y0: Number(e.target.value) })}
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-0.5 rounded text-[10px] w-full text-center focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] text-zinc-500 uppercase">h</span>
                            <input
                                type="number"
                                step="0.001"
                                value={stepSize}
                                onChange={(e) => updateNodeData(id, { stepSize: Number(e.target.value) })}
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-0.5 rounded text-[10px] w-full text-center focus:outline-none focus:border-zinc-500"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </BaseNode>
    );
});

ODESolverNode.displayName = 'ODESolverNode';
