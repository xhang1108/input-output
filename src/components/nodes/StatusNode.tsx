import { memo, useMemo } from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const StatusNode = memo((props: NodeProps) => {
    const { data } = props;

    // Status arrived from Engine via data.value (full payload)
    // Value shape: { state: 'ok' | 'fail' | 'void', raw: any }
    const status = useMemo(() => {
        const val = PayloadUtils.unwrap(data.value) as any;
        if (val && typeof val === 'object' && 'state' in val) {
            return val;
        }
        return { state: 'void', raw: null };
    }, [data.value]);

    const { state } = status;

    return (
        <BaseNode {...props}>
            <div className="p-3 bg-zinc-900/40 rounded-b-md flex flex-col items-center gap-4 min-w-[120px]">
                {/* Dual Lamp Panel */}
                <div className="bg-zinc-950 border border-zinc-800/50 p-3 rounded-xl shadow-inner flex flex-col gap-4 items-center w-full">

                    {/* OK Lamp (Green) */}
                    <div className="flex flex-col items-center gap-1 group">
                        <div
                            className={`w-10 h-10 rounded-full transition-all duration-300 border-2 ${state === 'ok'
                                ? 'bg-(--color-vector) border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-breathing'
                                : 'bg-emerald-950/20 border-emerald-900/30'
                                }`}
                        />
                        <span className={`text-[8px] font-bold uppercase tracking-tighter transition-opacity duration-300 ${state === 'ok' ? 'text-emerald-400 opacity-100' : 'text-zinc-700 opacity-50'
                            }`}>
                            True / 1
                        </span>
                    </div>

                    {/* GAP / Divider */}
                    <div className="w-full h-px bg-zinc-900/50" />

                    {/* FAIL Lamp (Red) */}
                    <div className="flex flex-col items-center gap-1 group">
                        <div
                            className={`w-10 h-10 rounded-full transition-all duration-300 border-2 ${state === 'fail'
                                ? 'bg-(--color-error) border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-breathing'
                                : 'bg-red-950/20 border-red-900/30'
                                }`}
                        />
                        <span className={`text-[8px] font-bold uppercase tracking-tighter transition-opacity duration-300 ${state === 'fail' ? 'text-red-400 opacity-100' : 'text-zinc-700 opacity-50'
                            }`}>
                            False / 0
                        </span>
                    </div>
                </div>

                {/* Void state label */}
                {state === 'void' && (
                    <div className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest animate-pulse">
                        Signal Void
                    </div>
                )}
            </div>
        </BaseNode>
    );
});

StatusNode.displayName = 'StatusNode';
