'use client';

import { Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { useState, memo, useEffect } from 'react';
import { NodeShell } from './NodeShell';
import { SourceHandle } from '../handles/SourceHandle';
import { Input } from '@/components/ui/input';

export const NodeInputNumber = memo(({ id, data, selected }: NodeProps) => {
    const { updateNodeData } = useReactFlow();

    // Local state for snappy typing
    const [localValue, setLocalValue] = useState<string>(data.rawExpression as string || String(data.value || 0));
    const [localSymbol, setLocalSymbol] = useState<string>(data.symbol as string || '');

    // Manual Debounce for Value
    useEffect(() => {
        const handler = setTimeout(() => {
            // Try parsing as number
            const num = parseFloat(localValue);
            const isValid = !isNaN(num);

            // Only update if changed
            if (data.value !== (isValid ? num : 0) || data.rawExpression !== localValue) {
                updateNodeData(id, {
                    value: isValid ? num : 0,
                    rawExpression: localValue,
                    label: data.label || 'Number',
                });
            }
        }, 300);

        return () => clearTimeout(handler);
    }, [localValue, id, updateNodeData, data.value, data.rawExpression]);

    // Manual Debounce for Symbol
    useEffect(() => {
        const handler = setTimeout(() => {
            if (data.symbol !== localSymbol) {
                updateNodeData(id, { symbol: localSymbol });
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [localSymbol, id, updateNodeData, data.symbol]);

    const isMuted = !!data.muted;

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-blue-500 rounded-xl p-3 min-w-[140px] hover:border-blue-400 transition-colors relative ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        Number Input
                    </div>
                    {/* Optional Symbol Input */}
                    <input
                        className="w-8 text-[10px] bg-zinc-100 border-none rounded text-center text-purple-600 font-bold focus:ring-1 focus:ring-purple-400 placeholder-zinc-300"
                        placeholder="var"
                        value={localSymbol}
                        onChange={(e) => setLocalSymbol(e.target.value)}
                        title="Assign Variable Name (e.g. 'x')"
                    />
                </div>

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
