import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const InputNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            brain.applyTransaction({
                type: 'UPDATE_VALUE',
                payload: { id, value: val } // Brain will wrap this
            });
        }
    }, [id, brain]);

    const displayValue = Number(PayloadUtils.unwrap(data.value)) || 0;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Value</label>
                {data.type === 'string' ? (
                    <input
                        type="text"
                        className="nodrag w-full border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:border-blue-500 outline-none"
                        style={{ background: 'var(--node-bg)' }}
                        placeholder="Text..."
                        value={String(PayloadUtils.unwrap(data.value) || '')}
                        onChange={(e) => {
                            brain.applyTransaction({
                                type: 'UPDATE_VALUE',
                                payload: { id, value: PayloadUtils.createSymbolic(e.target.value) }
                            });
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                ) : (
                    <input
                        type="number"
                        className="nodrag w-full border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:border-blue-500 outline-none"
                        style={{ background: 'var(--node-bg)' }}
                        placeholder="0.0"
                        value={displayValue}
                        onChange={handleChange}
                        onKeyDown={(e) => {
                            e.stopPropagation(); // Prevent React Flow hotkeys

                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                let step = 1;
                                if (e.shiftKey) step = 0.1;
                                if (e.altKey) step = 10;

                                const delta = e.key === 'ArrowUp' ? step : -step;

                                // If modifiers are used, we override default browser behavior
                                // Or if we just want consistent control
                                e.preventDefault();

                                // Get current value from input because props might be stale if typing fast
                                const currentVal = parseFloat(e.currentTarget.value) || 0;
                                // Round to 2 decimals if using small steps, otherwise keep precision? 
                                // Actually for 0.1 steps, 2 decimals is safe.
                                const newVal = parseFloat((currentVal + delta).toFixed(2));

                                // Update UI immediately (optional, but good for responsiveness)
                                e.currentTarget.value = String(newVal); // This might desync with React state if not careful

                                // Update Brain
                                brain.applyTransaction({
                                    type: 'UPDATE_VALUE',
                                    payload: { id, value: newVal }
                                });
                            }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                )}
            </div>
        </BaseNode>
    );
});
InputNode.displayName = 'InputNode';
