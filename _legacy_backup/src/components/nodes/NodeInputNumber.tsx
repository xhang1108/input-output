'use client';

import { Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { memo, useCallback } from 'react';
import { NodeShell } from './NodeShell';
import { SourceHandle } from '../handles/SourceHandle';
import { Input } from '@/components/ui/input';
import { NodeHeader } from './NodeHeader';
import { useNodeDebounce } from './hooks/useNodeDebounce';

export const NodeInputNumber = memo(({ id, data, selected }: NodeProps) => {
    const { updateNodeData } = useReactFlow();

    // Use atomic debounce hook for value
    const [localValue, setLocalValue] = useNodeDebounce(
        id,
        data.rawExpression as string || String(data.value || 0),
        useCallback((val) => {
            // Use strict Number() parsing instead of parseFloat to avoid treating "2x" as 2.
            // Strings like "2x+5" will result in NaN, allowing Brain.ts to use rawExpression.
            const num = Number(val);
            const isValid = !isNaN(num) && val.trim() !== '';
            return {
                value: isValid ? num : null,
                rawExpression: val,
                label: data.label || 'Number',
            };
        }, [data.label])
    );

    // Use atomic debounce hook for symbol
    const [localSymbol, setLocalSymbol] = useNodeDebounce(
        id,
        data.symbol as string || '',
        useCallback((val) => ({ symbol: val }), [])
    );

    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-blue-500 rounded-xl p-3 min-w-[140px] min-h-[100px] hover:border-blue-400 transition-colors relative flex flex-col ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <div className="flex flex-col gap-2">
                <NodeHeader
                    label="Number Input"
                    editableLabel={{
                        value: localSymbol,
                        onChange: setLocalSymbol,
                        placeholder: "Input Name"
                    }}
                />

                <div className="relative">
                    <Input
                        className="text-2xl font-bold font-mono text-center border-zinc-200 focus:border-blue-500 h-10 bg-zinc-50 text-blue-600"
                        value={localValue}
                        onChange={(e) => {
                            // Automatically strip all spaces (Paste & Type)
                            const cleanValue = e.target.value.replace(/\s/g, '');
                            setLocalValue(cleanValue);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </div>
            </div>

            <SourceHandle
                position={Position.Right}
                id="output"
            />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data.value === next.data.value &&
    prev.data.rawExpression === next.data.rawExpression &&
    prev.data.symbol === next.data.symbol &&
    prev.data.muted === next.data.muted
));
