import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useHistoryStore } from '../../store/useHistoryStore';
import { Transaction } from '../../engine/types/engineTypes';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NumericInput } from '../common/NumericInput';
import { StringInput } from '../common/StringInput';

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

    const handleStringChange = useCallback((val: string) => {
        setLocalValue(val);
        brain.applyTransaction({ type: 'UPDATE_NODE_DATA', payload: { id, data: { value: val } } });
    }, [id, brain]);

    const handleDataFocus = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        originalValue.current = unwrappedValue;
        setIsFocused(true);
        e.currentTarget.select();
    }, [unwrappedValue]);

    const handleDataBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
                    <StringInput
                        value={localValue}
                        onChange={handleStringChange}
                        onFocus={handleDataFocus}
                        onBlur={handleDataBlur}
                        onKeyDown={handleKeyDown}
                        placeholder="Text..."
                        className="w-full"
                        inputClassName="w-full h-8 text-sm text-left"
                        monospace={true} // Match IN-01's font-mono
                        autoSelect={false} // InputNode handles selection in onFocus
                    />
                ) : (
                    <NumericInput
                        value={Number(unwrappedValue) || 0}
                        onChange={(val) => brain.applyTransaction({ type: 'UPDATE_NODE_DATA', payload: { id, data: { value: val } } })}
                        onFocus={handleDataFocus}
                        onBlur={handleDataBlur}
                        className="w-full"
                        inputClassName="w-full h-8 text-sm"
                        hideLabel={true}
                    />
                )}
            </div>
        </BaseNode>
    );
});
InputNode.displayName = 'InputNode';

