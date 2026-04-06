'use client';

import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';
import { NumericInput } from '../common/NumericInput';

export const DifferentialNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();

    const order = Number(data.order) || 1;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-stretch justify-center min-w-[130px] w-full">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Derivative
                </div>

                <div className="w-full flex flex-col gap-2">
                    {/* Variable Selection */}
                    <NodeOpSelect
                        nodeId={id}
                        defId="CL-01"
                        paramId="variable"
                        data={data}
                        label="Variable (d/d)"
                        width="full"
                    />

                    {/* Order Selection */}
                    <NumericInput
                        label="Order"
                        value={order}
                        onChange={(val) => updateNodeData(id, { order: Math.max(1, Math.min(5, val)) })}
                        hideLabel={false}
                        inputClassName="h-6 text-[10px] px-1 text-center"
                        className="w-full"
                    />
                </div>
            </div>
        </BaseNode>
    );
});

DifferentialNode.displayName = 'DifferentialNode';
