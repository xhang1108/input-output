'use client';

import { Handle, Position, useReactFlow } from '@xyflow/react';
import { useState, memo, useEffect } from 'react';
import { Box } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NodeShell } from './NodeShell';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';

interface NodeInputProps {
    id: string;
    data: { label?: string; value?: number; rawExpression?: string; muted?: boolean; symbol?: string };
}

export const NodeInput = memo(({ id, data, selected }: NodeInputProps & { selected?: boolean }) => {
    const { updateNodeData, setNodes } = useReactFlow();
    const { triggerLogicUpdate } = useAppStore();
    const [value, setValue] = useState(data.rawExpression ?? data.value ?? 0);
    // Local state for the variable name editing to prevent jitter
    const [symbol, setSymbol] = useState(data.symbol || '');

    const isMuted = !!data.muted;

    // Debounce for expensive graph updates
    useEffect(() => {
        const handler = setTimeout(() => {
            const numVal = parseFloat(String(value));
            const safeVal = isNaN(numVal) ? 0 : numVal;

            // Only update flow data if changed to avoid loop
            if (data.rawExpression !== value || data.value !== safeVal || data.symbol !== symbol) {
                updateNodeData(id, {
                    rawExpression: String(value),
                    value: safeVal,
                    symbol: symbol
                });
                triggerLogicUpdate();
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(handler);
    }, [value, symbol, id, updateNodeData, triggerLogicUpdate]); // Removed data dependency to break loop

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
    };

    const onSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSym = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
        setSymbol(newSym);
    };

    const onFocus = () => {
        setNodes((nodes) => nodes.map((n) => ({
            ...n,
            selected: n.id === id,
        })));
    };

    return (
        <NodeShell
            selected={selected}
            className={`bg-white border-2 border-blue-500 rounded-xl p-4 min-w-[140px] hover:border-blue-400 ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <div className="flex items-center justify-between w-full mb-2">
                <div className="flex items-center gap-2">
                    <Box className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                        {data.label || 'Input'}
                    </span>
                </div>

                <div className="flex items-center gap-1 bg-zinc-100 px-1 rounded border border-zinc-200" title="Symbolic Variable Name">
                    <span className="text-[9px] text-purple-400 font-bold">x:</span>
                    <input
                        className="w-8 bg-transparent border-none p-0 text-[10px] font-mono text-purple-600 focus:outline-none focus:ring-0 text-right"
                        placeholder="var"
                        value={symbol}
                        onChange={onSymbolChange}
                    />
                </div>
            </div>

            <Input
                type="text"
                value={value}
                onChange={onChange}
                onFocus={onFocus}
                className="w-32 h-8 font-mono text-sm nodrag text-zinc-900 bg-zinc-50 border-zinc-200 placeholder:text-zinc-400"
                placeholder="2x + 5..."
            />

            <div className="mt-2 pt-2 border-t border-zinc-100 w-full">
                <input
                    value={data.label || ''}
                    onChange={(e) => updateNodeData(id, { label: e.target.value })}
                    className="w-full text-xs bg-transparent border-none text-zinc-400 focus:text-zinc-600 placeholder:text-zinc-300 focus:outline-none text-center"
                    placeholder="Label (Optional)"
                />
            </div>

            <SourceHandle
                position={Position.Right}
                id="output"
                color="blue"
            />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));
