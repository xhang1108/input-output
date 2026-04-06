'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';
import { useBrain } from '../../context/BrainContext';
import { NumericInput } from '../common/NumericInput';


export const DifferentialNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const { updateNodeData } = useReactFlow();




    const variable = (data.variable as string) || 'x';
    const order = Number(data.order) || 1;



    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[130px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Derivative
                </div>

                <div className="spacer h-1" />

                <div className="w-full flex flex-col gap-2">
                    {/* d/dx Selection */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Variable</span>
                        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700/50 rounded-md p-1 pl-2">
                            <span className="text-[10px] text-zinc-500 font-mono">d/d</span>
                            <div className="flex-1">
                                <NodeOpSelect
                                    nodeId={id}
                                    defId="CL-01"
                                    paramId="variable"
                                    data={data}
                                    label=""
                                    width="full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Order Selection */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Order</span>
                        <NumericInput
                            value={order}
                            onChange={(val) => updateNodeData(id, { order: Math.max(1, Math.min(5, val)) })}
                            hideLabel={true}
                            inputClassName="h-6 text-[10px] px-1 text-center"
                            className="w-full"
                        />
                    </div>
                </div>

            </div>
        </BaseNode>
    );
});

DifferentialNode.displayName = 'DifferentialNode';

