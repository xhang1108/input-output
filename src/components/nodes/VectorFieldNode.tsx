import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { NumericInput } from '../common/NumericInput';
import { StringInput } from '../common/StringInput';

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

                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-1">
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Var 1</span>
                        <StringInput
                            value={var1}
                            onChange={(val) => updateData({ var1: val })}
                            variant="standard"
                            monospace={true}
                            hideLabel={true}
                            inputClassName="w-full h-6 text-[10px] px-1 text-center"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Var 2</span>
                        <StringInput
                            value={var2}
                            onChange={(val) => updateData({ var2: val })}
                            variant="standard"
                            monospace={true}
                            hideLabel={true}
                            inputClassName="w-full h-6 text-[10px] px-1 text-center"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Min</span>
                        <NumericInput
                            value={min}
                            onChange={(val) => updateData({ min: val })}
                            hideLabel={true}
                            inputClassName="w-full h-6 text-[10px] px-1 text-center"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Max</span>
                        <NumericInput
                            value={max}
                            onChange={(val) => updateData({ max: val })}
                            hideLabel={true}
                            inputClassName="w-full h-6 text-[10px] px-1 text-center"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Density</span>
                    <NumericInput
                        value={density}
                        onChange={(val) => updateData({ density: val })}
                        hideLabel={true}
                        inputClassName="w-full h-6 text-[10px] px-1 text-center"
                    />
                </div>
            </div>
        </BaseNode>
    );
});

VectorFieldNode.displayName = 'VectorFieldNode';

