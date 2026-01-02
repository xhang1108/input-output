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

interface NodeMathProps {
    id: string;
    data: { operation?: string };
}

const operations = [
    { value: 'add', label: '+' },
    { value: 'sub', label: '−' },
    { value: 'mul', label: '×' },
    { value: 'div', label: '÷' },
];

export function NodeMath({ id, data }: NodeMathProps) {
    const { updateNodeData } = useReactFlow();
    const [op, setOp] = useState(data.operation || 'add');

    const onSelect = (value: string) => {
        setOp(value);
        updateNodeData(id, { operation: value });
    };

    const currentLabel = operations.find((o) => o.value === op)?.label || '+';

    return (
        <div className="bg-zinc-200 border-2 border-orange-400 rounded-full w-[80px] h-[80px] shadow-lg flex flex-col items-center justify-center relative group hover:border-orange-500 transition-all">
            <Handle
                type="target"
                position={Position.Left}
                id="a"
                style={{ top: '30%' }}
                className="!w-2 !h-2 !bg-orange-500 !border-2 !border-zinc-200"
            />
            <Handle
                type="target"
                position={Position.Left}
                id="b"
                style={{ top: '70%' }}
                className="!w-2 !h-2 !bg-orange-500 !border-2 !border-zinc-200"
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

            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-orange-500 !border-2 !border-zinc-200"
            />
        </div>
    );
}
