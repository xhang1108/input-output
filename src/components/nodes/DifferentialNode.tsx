'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';
import { useBrain } from '../../context/BrainContext';


export const DifferentialNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const { updateNodeData } = useReactFlow();




    const variable = (data.variable as string) || 'x';
    const order = Number(data.order) || 1;



    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[120px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Derivative
                </div>

                <div className="w-full flex flex-col gap-1.5">
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8">d/d</span>
                        <div className="flex-1">
                            <NodeOpSelect
                                nodeId={id}
                                defId="CL-01"
                                paramId="variable"
                                data={data}
                                label=""
                                width="36"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8">Ord</span>
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={order}
                            onChange={(e) => updateNodeData(id, { order: Math.max(1, Math.min(5, Number(e.target.value))) })}
                            className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-12 text-center focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                    </div>
                </div>

            </div>
        </BaseNode>
    );
});

DifferentialNode.displayName = 'DifferentialNode';
