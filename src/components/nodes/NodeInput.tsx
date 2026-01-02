'use client';

import { Handle, Position, useReactFlow } from '@xyflow/react';
import { useState } from 'react';
import { Box } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface NodeInputProps {
    id: string;
    data: { label?: string; value?: number };
}

export function NodeInput({ id, data }: NodeInputProps) {
    const { updateNodeData } = useReactFlow();
    const [value, setValue] = useState(data.value || 0);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = Number(e.target.value);
        setValue(newVal);
        updateNodeData(id, { value: newVal });
    };

    return (
        <div className="bg-zinc-200 border border-zinc-300 rounded-xl p-3 shadow-lg hover:shadow-xl hover:border-blue-400 transition-all group">
            <div className="flex items-center gap-2 mb-2">
                <Box className="w-3 h-3 text-blue-500" />
                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                    {data.label || 'Input'}
                </div>
            </div>

            <Input
                type="number"
                value={value}
                onChange={onChange}
                className="w-24 h-8 font-mono text-sm nodrag [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />

            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-blue-500 !border-2 !border-zinc-200"
            />
        </div>
    );
}
