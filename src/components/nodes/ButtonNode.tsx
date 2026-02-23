import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const ButtonNode = memo((props: NodeProps) => {
    const { id, data } = props;

    // We unwrap the value to check if it's currently true (pressed)
    const isActive = !!PayloadUtils.unwrap(data.value);

    const handles = [
        { id: 'out', type: 'source', position: 'right', variant: 'single', dataType: 'boolean' }
    ];

    const nodeData = { ...data, handles };

    const isSticky = (data as any).mode !== 'momentary'; // Default to sticky (toggle)

    const toggleActive = useCallback(() => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { value: !isActive } }
        });
    }, [id, isActive]);

    const setPressed = useCallback((pressed: boolean) => {
        if (isSticky) return;
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { value: pressed } }
        });
    }, [id, isSticky]);

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col items-center gap-4 p-3 min-w-[100px]">
                <div className="flex justify-between items-center w-full">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Mode</label>
                    <select
                        className="nodrag bg-transparent text-[8px] text-zinc-500 border border-zinc-700/50 rounded-xs outline-none cursor-pointer hover:bg-zinc-800 transition-colors uppercase font-bold"
                        value={(data as any).mode || 'sticky'}
                        onChange={(e) => {
                            Brain.getInstance().applyTransaction({
                                type: 'UPDATE_NODE_DATA',
                                payload: { id, data: { mode: e.target.value, value: false } }
                            });
                        }}
                    >
                        <option value="sticky">Sticky</option>
                        <option value="momentary">Momentary</option>
                    </select>
                </div>

                <div className="relative">
                    {/* Outer Glow Ring */}
                    <div className={`
                        absolute -inset-2 rounded-full blur-lg transition-opacity duration-300
                        ${isActive ? 'bg-orange-500/40 opacity-100' : 'opacity-0'}
                    `} />

                    <button
                        className={`
                            nodrag relative w-16 h-16 rounded-full transition-all duration-75 
                            flex items-center justify-center border-2
                            ${isActive
                                ? 'bg-orange-500 border-orange-400 scale-90 shadow-[inset_0_4px_8px_rgba(0,0,0,0.4)] translate-y-1'
                                : 'bg-linear-to-b from-zinc-700 to-zinc-800 border-zinc-600 shadow-[0_6px_0_rgb(39,39,42),0_10px_15px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-none'
                            }
                        `}
                        onClick={() => isSticky && toggleActive()}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            if (!isSticky) setPressed(true);
                        }}
                        onMouseUp={() => !isSticky && setPressed(false)}
                        onMouseLeave={() => !isSticky && isActive && setPressed(false)}
                        onTouchStart={(e) => {
                            e.preventDefault();
                            if (!isSticky) setPressed(true);
                        }}
                        onTouchEnd={() => !isSticky && setPressed(false)}
                    >
                        {/* Inner detail */}
                        <div className={`
                            w-8 h-8 rounded-full border-2 flex items-center justify-center
                            ${isActive ? 'border-white/30 bg-white/10' : 'border-zinc-500/20 bg-black/5'}
                        `}>
                            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-white shadow-[0_0_10px_white]' : 'bg-zinc-600'}`} />
                        </div>
                    </button>
                </div>

                <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${isActive ? 'text-orange-400' : 'text-zinc-500'}`}>
                        {isSticky ? 'Toggle' : 'Momentary'}
                    </span>
                    <span className="text-[9px] font-medium text-zinc-600 uppercase">
                        {isActive ? 'Active' : 'Standby'}
                    </span>
                </div>
            </div>
        </BaseNode>
    );
});

ButtonNode.displayName = 'ButtonNode';
