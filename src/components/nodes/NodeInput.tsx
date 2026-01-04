'use client';

import { Handle, Position, useReactFlow } from '@xyflow/react';
import { useState } from 'react';
import { Box } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NodeShell } from './NodeShell';
import { SourceHandle } from '../handles/SourceHandle';

interface NodeInputProps {
    id: string;
    data: { label?: string; value?: number; rawExpression?: string };
}

export function NodeInput({ id, data, selected }: NodeInputProps & { selected?: boolean }) {
    const { updateNodeData, setNodes } = useReactFlow();
    const [value, setValue] = useState(data.rawExpression ?? data.value ?? 0);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setValue(newVal);

        // Try to parse as number for immediate value if possible, else just store string
        const numVal = parseFloat(newVal);
        updateNodeData(id, {
            rawExpression: newVal,
            value: isNaN(numVal) ? 0 : numVal // Optional: keep value sync if numeric
        });
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
            className="bg-zinc-200 border border-zinc-300 rounded-xl p-3 shadow-lg hover:shadow-xl hover:border-blue-400"
        >
            <div className="flex items-center gap-2 mb-2">
                <Box className="w-3 h-3 text-blue-500" />
                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                    {data.label || 'Input'}
                </div>
            </div>

            <Input
                type="text"
                value={value}
                onChange={onChange}
                onFocus={onFocus}
                className="w-32 h-8 font-mono text-sm nodrag"
                placeholder="2x + 5..."
            />

            <SourceHandle
                position={Position.Right}
                color="blue"
            />
        </NodeShell>
    );
}
