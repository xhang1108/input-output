import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { NumericInput } from '../common/NumericInput';
import { NodeOpSelect } from './NodeOpSelect';
import { CategorizedMenuItem } from '../ui/CategorizedMenu';

const METHOD_ITEMS: CategorizedMenuItem[] = [
    { id: 'RK4', label: 'RK4 (Runge-Kutta)', category: 'Higher Order' },
    { id: 'Euler', label: 'Euler Method', category: 'First Order' },
];

export const ODESolverNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();

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

                <div className="w-full flex flex-col gap-2">
                    {/* Method Selector */}
                    <NodeOpSelect
                        nodeId={id}
                        defId="CL-05"
                        paramId="method"
                        data={data}
                        label="Method"
                        width="full"
                        overrideOptions={METHOD_ITEMS}
                    />

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
            </div>
        </BaseNode>
    );
});

ODESolverNode.displayName = 'ODESolverNode';
