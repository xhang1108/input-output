import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';

export const LimitNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();

    const variable = (data.variable as string) || 'x';
    const approach = (data.approach as string) || '0';
    const direction = (data.direction as string) || 'both';

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[120px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Limit
                </div>

                <div className="w-full flex flex-col gap-1.5">
                    {/* Variable */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8">Var</span>
                        <select
                            value={variable}
                            onChange={(e) => updateNodeData(id, { variable: e.target.value })}
                            className="nodrag bg-zinc-900 text-zinc-300 text-[10px] flex-1 p-1 rounded border border-zinc-700 focus:outline-none focus:border-zinc-500"
                        >
                            {['x', 'y', 'z', 't', 'n'].map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>

                    {/* Approach Value */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8">→</span>
                        <input
                            className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] flex-1 text-center focus:outline-none focus:border-zinc-500 transition-colors"
                            value={approach}
                            onChange={(e) => updateNodeData(id, { approach: e.target.value })}
                            placeholder="0"
                        />
                    </div>

                    {/* Direction */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8">Side</span>
                        <select
                            value={direction}
                            onChange={(e) => updateNodeData(id, { direction: e.target.value })}
                            className="nodrag bg-zinc-900 text-zinc-300 text-[10px] flex-1 p-1 rounded border border-zinc-700 focus:outline-none focus:border-zinc-500"
                        >
                            <option value="both">Both (±)</option>
                            <option value="left">Left (⁻)</option>
                            <option value="right">Right (⁺)</option>
                        </select>
                    </div>
                </div>
            </div>
        </BaseNode>
    );
});

LimitNode.displayName = 'LimitNode';
