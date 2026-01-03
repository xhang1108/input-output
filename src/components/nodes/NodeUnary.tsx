'use client';

import { Handle, Position, useReactFlow } from '@xyflow/react';
import { useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface NodeUnaryProps {
    id: string;
    data: { operation?: string; result?: number; error?: string };
}

const operations = [
    { value: 'sqrt', label: '√' },
    { value: 'sin', label: 'sin' },
    { value: 'cos', label: 'cos' },
    { value: 'tan', label: 'tan' },
    { value: 'abs', label: 'abs' },
    { value: 'log', label: 'log' },
    { value: 'round', label: 'round' },
];

export function NodeUnary({ id, data }: NodeUnaryProps) {
    const { updateNodeData } = useReactFlow();
    const [op, setOp] = useState(data.operation || 'sqrt');

    const onSelect = (value: string) => {
        setOp(value);
        updateNodeData(id, { operation: value });
    };

    return (
        <div className="bg-zinc-200 border-2 border-purple-500 rounded-lg p-3 shadow-md min-w-[120px]">
            <div className="text-xs text-purple-500 mb-2 font-bold uppercase tracking-wider">
                Trig / Math
            </div>

            <Select value={op} onValueChange={onSelect}>
                <SelectTrigger className="w-full nodrag">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {operations.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                            {o.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Result Display */}
            <div className="mt-2 pt-2 border-t border-purple-200 flex justify-center">
                {data.error ? (
                    <span className="text-red-500 text-xs font-bold">⚠️ Error</span>
                ) : (
                    <span className="text-zinc-600 font-mono font-bold text-sm">
                        {(typeof data.result === 'number' && !isNaN(data.result))
                            ? Number.isInteger(data.result) ? data.result : data.result.toFixed(2)
                            : '...'}
                    </span>
                )}
            </div>

            <Handle
                type="target"
                position={Position.Left}
                id="in"
                className="!w-2 !h-2 !bg-purple-500 !border-2 !border-zinc-200"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-purple-500 !border-2 !border-zinc-200"
            />
        </div>
    );
}
