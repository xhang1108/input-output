'use client';

import { Handle, Position, useReactFlow } from '@xyflow/react';
import { useState } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface NodeMathProps {
    id: string;
    data: { operation?: string; result?: number; error?: string };
}

const operations = [
    { value: 'add', label: '+' },
    { value: 'sub', label: '−' },
    { value: 'mul', label: '×' },
    { value: 'div', label: '÷' },
    { value: 'pow', label: '^' },
    { value: 'mod', label: '%' },
];

export function NodeMath({ id, data, selected }: NodeMathProps & { selected?: boolean }) {
    const { updateNodeData } = useReactFlow();
    const [op, setOp] = useState(data.operation || 'add');

    const onSelect = (value: string) => {
        setOp(value);
        updateNodeData(id, { operation: value });
    };

    const currentLabel = operations.find((o) => o.value === op)?.label || '+';

    return (
        <NodeShell
            selected={selected}
            className="bg-zinc-200 border-2 border-orange-400 rounded-full w-[80px] h-[80px] shadow-lg flex flex-col items-center justify-center relative hover:border-orange-500"
        >
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="a"
                style={{ top: '30%' }}
            />
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="b"
                style={{ top: '70%' }}
            />


            <Select value={op} onValueChange={onSelect}>
                <SelectTrigger className="w-12 h-12 border-none bg-transparent text-3xl font-bold text-orange-500 justify-center nodrag [&>svg]:hidden">
                    <SelectValue>{currentLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {operations.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                            <span className="text-lg font-bold">{o.label}</span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Result Display */}
            <div className="absolute -bottom-8 bg-zinc-100 rounded px-2 py-0.5 border border-zinc-300 shadow-sm whitespace-nowrap z-10">
                {data.error ? (
                    <span className="text-red-500 text-xs text-center font-bold">⚠️ Error</span>
                ) : (
                    <span className="text-zinc-600 font-mono font-bold text-xs">
                        {(typeof data.result === 'number' && !isNaN(data.result))
                            ? Number.isInteger(data.result) ? data.result : data.result.toFixed(2)
                            : '...'}
                    </span>
                )}
            </div>

            <SourceHandle
                position={Position.Right}
                color="orange"
            />
        </NodeShell>
    );
}
