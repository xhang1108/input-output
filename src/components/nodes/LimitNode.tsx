import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { StringInput } from '../common/StringInput';
import { NodeOpSelect } from './NodeOpSelect';
import { CategorizedMenuItem } from '../ui/CategorizedMenu';

const VAR_ITEMS: CategorizedMenuItem[] = [
    { id: 'x', label: 'x', category: 'Variables' },
    { id: 'y', label: 'y', category: 'Variables' },
    { id: 't', label: 't', category: 'Variables' },
    { id: 'u', label: 'u', category: 'Variables' },
    { id: 'v', label: 'v', category: 'Variables' },
];

const SIDE_ITEMS: CategorizedMenuItem[] = [
    { id: 'both', label: 'Both Directions', category: 'Limit Side' },
    { id: 'left', label: 'Left Side (-)', category: 'Limit Side' },
    { id: 'right', label: 'Right Side (+)', category: 'Limit Side' },
];

export const LimitNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();

    const to = (data.to as string) || '0';

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[140px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Limit
                </div>

                <div className="w-full flex flex-col gap-2">
                    {/* Variable and Direction */}
                    <div className="grid grid-cols-2 gap-2">
                        <NodeOpSelect
                            nodeId={id}
                            defId="CL-02"
                            paramId="variable"
                            data={data}
                            label="Variable"
                            width="full"
                            overrideOptions={VAR_ITEMS}
                        />
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">To (→)</span>
                            <StringInput
                                value={to}
                                onChange={(val) => updateNodeData(id, { to: val })}
                                variant="standard"
                                monospace={true}
                                hideLabel={true}
                                inputClassName="text-center h-6 px-1 text-[10px] w-full"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    {/* Side/Direction */}
                    <NodeOpSelect
                        nodeId={id}
                        defId="CL-02"
                        paramId="side"
                        data={data}
                        label="Side"
                        width="full"
                        overrideOptions={SIDE_ITEMS}
                    />
                </div>
            </div>
        </BaseNode>
    );
});

LimitNode.displayName = 'LimitNode';
