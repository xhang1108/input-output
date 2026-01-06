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
                id="inputA"
                style={{ top: '30%' }}
            />
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputB"
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
            {data.error ? (
                <span className="text-red-500 text-xs text-center font-bold">⚠️ Error</span>
            ) : (
                <span className="text-zinc-600 font-mono font-bold text-xs">
                    {(() => {
                        const val = data.result as any;
                        if (typeof val === 'number' && !isNaN(val)) {
                            return Number.isInteger(val) ? val : val.toFixed(2);
                        } else if (val && val.toFixed) {
                            return val.toFixed(2).replace(/\.?0+$/, '');
                        }
                        return '...';
                    })()}
                </span>
            )}

            <SourceHandle
                position={Position.Right}
                color="orange"
            />
        </NodeShell>
    );
}
