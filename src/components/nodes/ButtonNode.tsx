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

    const setPressed = useCallback((pressed: boolean) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_VALUE',
            payload: { id, value: pressed }
        });
    }, [id]);

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col items-center gap-4 p-3 min-w-[100px]">
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
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            setPressed(true);
                        }}
                        onMouseUp={() => setPressed(false)}
                        onMouseLeave={() => isActive && setPressed(false)}
                        onTouchStart={(e) => {
                            e.preventDefault();
                            setPressed(true);
                        }}
                        onTouchEnd={() => setPressed(false)}
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
                        Momentary
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
