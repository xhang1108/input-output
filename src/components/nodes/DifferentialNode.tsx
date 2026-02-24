import { memo, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';

export const DifferentialNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();

    const variable = (data.variable as string) || 'x';
    const order = Number(data.order) || 1;

    // Auto-detect variables from connected expression (placeholder)
    const detectedVars = useMemo(() => {
        return ['x', 'y', 'z', 't'];
    }, []);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[120px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Derivative
                </div>

                <div className="w-full flex flex-col gap-1.5">
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8">d/d</span>
                        <select
                            value={variable}
                            onChange={(e) => updateNodeData(id, { variable: e.target.value })}
                            className="nodrag bg-zinc-900 text-zinc-300 text-[10px] flex-1 p-1 rounded border border-zinc-700 focus:outline-none focus:border-zinc-500"
                        >
                            {detectedVars.map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
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
