import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { Play, Pause, RotateCcw } from 'lucide-react';

/**
 * TimerNode (IN-11)
 * 
 * A high-performance, engine-driven numeric accumulator.
 * Optimized with localized subscription to prevent global UI thrashing 
 * during high-frequency (60fps) increment cycles.
 */
interface TimerData {
    currentValue?: number;
    initialValue?: number;
    step?: number;
    interval?: number;
    running?: boolean;
    label?: string;
}

export const TimerNode = memo((props: NodeProps) => {
    const id = props.id;
    const data = props.data as TimerData;
    const brain = useBrain();
    
    // Internal state for UI fallback
    const [displayValue, setDisplayValue] = useState(data.currentValue ?? 0);
    const valueRef = useRef<HTMLSpanElement>(null);

    // Optimized Local Subscription: 
    // This allows the component to react to its own 'currentValue' changes 
    // inside the Brain without waiting for the global React Flow nodes array to sync.
    useEffect(() => {
        const cleanup = brain.on('graphChanged', () => {
            const node = brain.getNodesMap().get(id);
            if (node && node.type === 'IN-11') {
                const newVal = node.data.currentValue;
                // Spinal Reflex: Direct DOM update to bypass React's render phase
                if (valueRef.current) {
                    valueRef.current.textContent = String(newVal);
                } else {
                    setDisplayValue(newVal as number);
                }
            }
        });
        return cleanup;
    }, [id, brain]);

    const toggleRunning = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { running: !data.running } }
        });
    }, [id, brain, data.running]);

    const handleReset = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { currentValue: data.initialValue ?? 0 } }
        });
    }, [id, brain, data.initialValue]);

    const updateParam = useCallback((key: string, val: number) => {
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { [key]: val } }
        });
    }, [id, brain]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-3 p-2 min-w-[140px]">
                {/* Main Display - Premium Aesthetic */}
                <div className="flex items-center justify-between bg-zinc-900/80 rounded-lg p-3 border border-zinc-700/50 shadow-inner group transition-all hover:border-zinc-500/50">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter mb-1 select-none">Output</span>
                        <span 
                            ref={valueRef}
                            className="text-3xl font-mono font-bold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                        >
                            {displayValue}
                        </span>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 ml-4">
                        <button 
                            onClick={toggleRunning}
                            title={data.running ? "Pause" : "Start"}
                            className={`p-2 rounded-lg transition-all transform active:scale-95 ${
                                data.running 
                                ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' 
                                : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                            }`}
                        >
                            {data.running ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        </button>
                        <button 
                            onClick={handleReset}
                            title="Reset to Initial"
                            className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-100/10 rounded-lg transition-all transform active:scale-90"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>

                {/* Settings Grid - Fine-tuned inputs */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-1">
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest pl-0.5">Start</label>
                        <input 
                            type="number"
                            className="bg-black/40 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-zinc-600 focus:bg-black/60 transition-all outline-none"
                            value={data.initialValue ?? 0}
                            onChange={(e) => updateParam('initialValue', Number(e.target.value))}
                            onPointerDown={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest pl-0.5">Step</label>
                        <input 
                            type="number"
                            className="bg-black/40 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-zinc-600 focus:bg-black/60 transition-all outline-none"
                            value={data.step ?? 1}
                            onChange={(e) => updateParam('step', Number(e.target.value))}
                            onPointerDown={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                        <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest pl-0.5">Interval (ms)</label>
                        <div className="relative group">
                            <input 
                                type="number"
                                min={1}
                                step={1}
                                className="w-full bg-black/40 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-zinc-600 focus:bg-black/60 transition-all outline-none pr-8"
                                value={data.interval ?? 1000}
                                onChange={(e) => updateParam('interval', Number(e.target.value))}
                                onBlur={(e) => updateParam('interval', Math.max(1, Number(e.target.value)))}
                                onPointerDown={e => e.stopPropagation()}
                            />
                            <span className="absolute right-2 top-1.5 text-[9px] text-zinc-600 font-bold">ms</span>
                        </div>
                    </div>
                </div>
            </div>
        </BaseNode>
    );
});
TimerNode.displayName = 'TimerNode';
