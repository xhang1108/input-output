import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { StringInput } from '../common/StringInput';
import { NodeOpSelect } from './NodeOpSelect';
import { CategorizedMenuItem } from '../ui/CategorizedMenu';

const MODE_ITEMS: CategorizedMenuItem[] = [
    { id: 'indefinite', label: 'Indefinite Integral (∫ f(x) dx)', category: 'Mode' },
    { id: 'definite', label: 'Definite Integral (∫[a,b] f(x) dx)', category: 'Mode' },
];

const VAR_ITEMS: CategorizedMenuItem[] = [
    { id: 'x', label: 'x', category: 'Variables' },
    { id: 'y', label: 'y', category: 'Variables' },
    { id: 't', label: 't', category: 'Variables' },
    { id: 'u', label: 'u', category: 'Variables' },
    { id: 'v', label: 'v', category: 'Variables' },
];

export const IntegralNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();

    const mode = (data.mode as string) || 'indefinite';
    const lower = (data.lower as string) || '';
    const upper = (data.upper as string) || '';

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[140px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Integral
                </div>

                <div className="w-full flex flex-col gap-2">
                    {/* Mode Selector */}
                    <NodeOpSelect
                        nodeId={id}
                        defId="CL-03"
                        paramId="mode"
                        data={data}
                        label="Mode"
                        width="full"
                        overrideOptions={MODE_ITEMS}
                    />

                    {/* Variable Selector */}
                    <NodeOpSelect
                        nodeId={id}
                        defId="CL-03"
                        paramId="variable"
                        data={data}
                        label="Variable"
                        width="full"
                        overrideOptions={VAR_ITEMS}
                    />

                    {/* Bounds */}
                    {mode === 'definite' && (
                        <div className="flex flex-col gap-1 animate-in slide-in-from-top-1 duration-200">
                            <div className="grid grid-cols-2 gap-1 px-0.5 text-[8px] text-zinc-600 uppercase font-bold tracking-widest text-center">
                                <span>Lower</span>
                                <span>Upper</span>
                            </div>
                            <div className="flex gap-1 items-center">
                                <StringInput
                                    value={lower}
                                    onChange={(val) => updateNodeData(id, { lower: val })}
                                    variant="standard"
                                    monospace={true}
                                    hideLabel={true}
                                    inputClassName="text-center h-6 px-1 text-[10px] flex-1 min-w-0"
                                    placeholder="a"
                                />
                                <span className="text-zinc-700 text-[8px]">→</span>
                                <StringInput
                                    value={upper}
                                    onChange={(val) => updateNodeData(id, { upper: val })}
                                    variant="standard"
                                    monospace={true}
                                    hideLabel={true}
                                    inputClassName="text-center h-6 px-1 text-[10px] flex-1 min-w-0"
                                    placeholder="b"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </BaseNode>
    );
});

IntegralNode.displayName = 'IntegralNode';
