import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useHistoryStore } from '../../store/useHistoryStore';
import { Transaction } from '../../engine/types/types';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const InputNode = memo((props: NodeProps) => {
    const { id, data, selected } = props;
    const { updateNodeData } = useReactFlow();
    const push = useHistoryStore(s => s.push);
    const isRestoring = useHistoryStore(s => s.isRestoring);
    const originalValue = useRef<any>(null);
    const brain = useBrain();
    const unwrappedValue = PayloadUtils.unwrap(data.value);
    
    // [IOGL Telemetry] Track data flow into component
    console.debug(`[InputNode:${id}:${data.label}] Data received:`, {
        rawValue: data.value,
        unwrapped: unwrappedValue,
        dataType: data.type,
        isStringNode: data.type === 'string'
    });

    const formatVal = (v: any) => (v === undefined || v === null) ? '' : String(v);
    const [localValue, setLocalValue] = useState(() => formatVal(unwrappedValue));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            const nextVal = formatVal(unwrappedValue);
            setLocalValue(prev => prev !== nextVal ? nextVal : prev);
        }
    }, [unwrappedValue, isFocused]);

    const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const valStr = e.target.value;
        setLocalValue(valStr);

        // Allow entering leading minus sign or empty string without immediate Brain sync
        if (valStr === '' || valStr === '-') return;

        const val = parseFloat(valStr);
        if (!isNaN(val)) brain.applyTransaction({ type: 'UPDATE_NODE_DATA', payload: { id, data: { value: val } } });
    }, [id, brain]);

    const handleStringChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        brain.applyTransaction({ type: 'UPDATE_NODE_DATA', payload: { id, data: { value: val } } });
    }, [id, brain]);

    const handleDataFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        originalValue.current = unwrappedValue;
        setIsFocused(true);
        e.currentTarget.select();
    }, [unwrappedValue]);

    const handleDataBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        const currentVal = e.target.value;
        const initialVal = originalValue.current;
        
        // Normalize comparing values
        const currentParsed = data.type === 'string' ? currentVal : parseFloat(currentVal);
        const initialParsed = initialVal;

        if (initialParsed !== currentParsed && !isRestoring && !isNaN(currentParsed as any)) {
            push({
                id: `edit_input_${id}_${Date.now()}`,
                description: `Edit Value: ${currentParsed}`,
                forward: [{ type: 'UPDATE_NODE_DATA', payload: { id, data: { value: currentParsed } } }],
                inverse: [{ type: 'UPDATE_NODE_DATA', payload: { id, data: { value: initialVal } } }]
            });
        }
        originalValue.current = null;
    }, [id, push, isRestoring, data.type]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            const initial = originalValue.current;
            if (initial !== null) {
                setLocalValue(formatVal(initial));
                brain.applyTransaction({ type: 'UPDATE_NODE_DATA', payload: { id, data: { value: initial } } });
            }
            e.currentTarget.blur();
            return;
        }

        e.stopPropagation();
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <BaseNode {...props}>
            <div 
                className="flex flex-col gap-2 p-1"
                onPointerDown={(e) => e.stopPropagation()}
            >
                {data.type === 'string' ? (
                    <input
                        type="text"
                        className="nodrag w-full border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:border-focus outline-none"
                        style={{ background: 'var(--node-bg)' }}
                        placeholder="Text..."
                        value={localValue}
                        onChange={handleStringChange}
                        onFocus={handleDataFocus}
                        onBlur={handleDataBlur}
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
                        onFocus={handleDataFocus}
                        onBlur={handleDataBlur}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={handleKeyDown}
                    />
                )}
            </div>
        </BaseNode>
    );
});
InputNode.displayName = 'InputNode';

