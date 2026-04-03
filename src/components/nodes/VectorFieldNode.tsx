import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';

export const VectorFieldNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

    // Engine expects: mode, var1, var2, min, max, density
    const mode = (data.mode as string) || 'gradient';
    const var1 = (data.var1 as string) || 'x';
    const var2 = (data.var2 as string) || 'y';
    const min = data.min !== undefined ? Number(data.min) : -5;
    const max = data.max !== undefined ? Number(data.max) : 5;
    const density = data.density !== undefined ? Number(data.density) : 10;

    const updateData = useCallback((updates: Partial<typeof data>) => {
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: updates }
        });
    }, [id, brain]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 min-w-[140px] nodrag" onMouseDown={(e) => e.stopPropagation()}>
                <div className="flex bg-black/40 rounded-lg p-0.5 border border-zinc-700/50">
                    <button
                        className={`flex-1 text-[10px] py-1 px-1.5 rounded-sm transition-all duration-200 ${mode === 'gradient' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        onClick={() => updateData({ mode: 'gradient' })}
                    >
                        Gradient
                    </button>
                    <button
                        className={`flex-1 text-[10px] py-1 px-1.5 rounded-md transition-all duration-200 ${mode === 'direct' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        onClick={() => updateData({ mode: 'direct' })}
                    >
                        Direct
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-1 mt-1">
                    <div className="flex flex-col">
                        <label className="text-[9px] text-zinc-500 uppercase font-bold pl-1">Var 1</label>
                        <input
                            type="text"
                            className="bg-black/20 border border-zinc-700/50 rounded-sm px-1.5 py-1 text-xs text-zinc-300 focus:border-focus/50 outline-none w-full"
                            value={var1}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateData({ var1: e.target.value })}
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[9px] text-zinc-500 uppercase font-bold pl-1">Var 2</label>
                        <input
                            type="text"
                            className="bg-black/20 border border-zinc-700/50 rounded-sm px-1.5 py-1 text-xs text-zinc-300 focus:border-focus/50 outline-none w-full"
                            value={var2}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateData({ var2: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-1 mt-1">
                    <div className="flex flex-col">
                        <label className="text-[9px] text-zinc-500 uppercase font-bold pl-1">Min</label>
                        <input
                            type="number"
                            className="bg-black/20 border border-zinc-700/50 rounded-sm px-1.5 py-1 text-xs text-zinc-300 focus:border-focus/50 outline-none w-full"
                            value={min}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateData({ min: Number(e.target.value) })}
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[9px] text-zinc-500 uppercase font-bold pl-1">Max</label>
                        <input
                            type="number"
                            className="bg-black/20 border border-zinc-700/50 rounded-sm px-1.5 py-1 text-xs text-zinc-300 focus:border-focus/50 outline-none w-full"
                            value={max}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateData({ max: Number(e.target.value) })}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between border border-zinc-700/50 rounded-sm p-1 bg-black/10 mt-1">
                    <label className="text-[9px] text-zinc-500 uppercase font-bold pl-1 w-full flex-1">Density</label>
                    <input
                        type="number"
                        className="w-12 bg-transparent text-right text-xs text-zinc-300 outline-none"
                        value={density}
                        min={2}
                        max={50}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateData({ density: Number(e.target.value) })}
                    />
                </div>
            </div>
        </BaseNode>
    );
});

VectorFieldNode.displayName = 'VectorFieldNode';

