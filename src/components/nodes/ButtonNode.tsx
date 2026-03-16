
'use client';

import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NodeOpSelect } from './NodeOpSelect';

export const ButtonNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

    const isActive = !!PayloadUtils.unwrap(data.value);
    const mode = (data as any).mode || 'sticky';
    const isSticky = mode !== 'momentary';

    const toggleActive = useCallback(() => {
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { value: !isActive } }
        });
    }, [id, isActive, brain]);

    const setPressed = useCallback((pressed: boolean) => {
        if (isSticky) return;
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { value: pressed } }
        });
    }, [id, isSticky, brain]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col items-center gap-4 p-3 min-w-[120px]">
                <div className="flex justify-between items-center w-full gap-2 -mt-1">
                    <NodeOpSelect
                        nodeId={id}
                        defId="IN-05"
                        paramId="mode"
                        data={data}
                        label="Mode"
                        width="32"
                    />
                </div>

                <div className="relative">
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
