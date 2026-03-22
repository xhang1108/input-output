import { memo, useCallback, useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const InputNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const unwrappedValue = PayloadUtils.unwrap(data.value);
    const [localValue, setLocalValue] = useState(String(unwrappedValue ?? ''));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) setLocalValue(String(unwrappedValue ?? ''));
    }, [unwrappedValue, isFocused]);

    const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) brain.applyTransaction({ type: 'UPDATE_VALUE', payload: { id, value: val } });
    }, [id, brain]);

    const handleStringChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        brain.applyTransaction({ type: 'UPDATE_VALUE', payload: { id, value: val } });
    }, [id, brain]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <BaseNode {...props}>
            <div 
                className="flex flex-col gap-2 p-1"
                onPointerDown={(e) => e.stopPropagation()}
            >
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Value</label>
                {data.type === 'string' ? (
                    <input
                        type="text"
                        className="nodrag w-full border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:border-focus outline-none"
                        style={{ background: 'var(--node-bg)' }}
                        placeholder="Text..."
                        value={localValue}
                        onChange={handleStringChange}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={handleKeyDown}
                    />
                ) : (
                    <input
                        type="number"
                        className="nodrag w-full border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:border-focus outline-none"
                        style={{ background: 'var(--node-bg)' }}
                        placeholder="0.0"
                        value={localValue}
                        onChange={handleNumberChange}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={handleKeyDown}
                    />
                )}
            </div>
        </BaseNode>
    );
});
InputNode.displayName = 'InputNode';
