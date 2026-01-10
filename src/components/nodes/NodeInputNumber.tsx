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
            const num = parseFloat(val);
            const isValid = !isNaN(num);
            return {
                value: isValid ? num : 0,
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
            className={`bg-white border-2 border-blue-500 rounded-xl p-3 min-w-[140px] hover:border-blue-400 transition-colors relative ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <div className="flex flex-col gap-2">
                <NodeHeader
                    label="Number Input"
                    symbolInput={{
                        value: localSymbol,
                        onChange: setLocalSymbol,
                        title: "Assign Variable Name (e.g. 'x')"
                    }}
                />

                <Input
                    className="text-2xl font-bold font-mono text-center border-zinc-200 focus:border-blue-500 h-10 bg-zinc-50"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                />
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
