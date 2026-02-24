import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';

export const IntegralNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();

    const variable = (data.variable as string) || 'x';
    const mode = (data.mode as string) || 'indefinite';
    const lower = (data.lower as string) || '';
    const upper = (data.upper as string) || '';

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[120px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Integral
                </div>

                <div className="w-full flex flex-col gap-1.5">
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-10">Mode</span>
                        <select
                            value={mode}
                            onChange={(e) => updateNodeData(id, { mode: e.target.value })}
                            className="nodrag bg-zinc-900 text-zinc-300 text-[10px] flex-1 p-1 rounded border border-zinc-700 focus:outline-none focus:border-zinc-500"
                        >
                            <option value="indefinite">∫ Indefinite</option>
                            <option value="definite">∫ₐᵇ Definite</option>
                        </select>
                    </div>

                    {/* Variable */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-10">d</span>
                        <select
                            value={variable}
                            onChange={(e) => updateNodeData(id, { variable: e.target.value })}
                            className="nodrag bg-zinc-900 text-zinc-300 text-[10px] flex-1 p-1 rounded border border-zinc-700 focus:outline-none focus:border-zinc-500"
                        >
                            {['x', 'y', 'z', 't'].map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>

                    {/* Bounds (only for definite) */}
                    {mode === 'definite' && (
                        <div className="flex gap-1">
                            <input
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-14 text-center focus:outline-none focus:border-zinc-500 transition-colors"
                                value={lower}
                                onChange={(e) => updateNodeData(id, { lower: e.target.value })}
                                placeholder="a"
                            />
                            <span className="text-zinc-500 text-[10px] self-center">→</span>
                            <input
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-14 text-center focus:outline-none focus:border-zinc-500 transition-colors"
                                value={upper}
                                onChange={(e) => updateNodeData(id, { upper: e.target.value })}
                                placeholder="b"
                            />
                        </div>
                    )}
                </div>
            </div>
        </BaseNode>
    );
});

IntegralNode.displayName = 'IntegralNode';
