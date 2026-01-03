'use client';

import { Handle, Position } from '@xyflow/react';
import { Box, Layers } from 'lucide-react';

interface NodeGroupProps {
    data: {
        label?: string;
        inputs?: { id: string; label: string }[];
        outputs?: { id: string; label: string }[];
        subNetwork?: any; // Storing the internal graph
    };
}

export function NodeGroup({ data }: NodeGroupProps) {
    const inputs = data.inputs || [];
    const outputs = data.outputs || [];

    return (
        <div className="bg-zinc-950 border-2 border-indigo-500/50 rounded-lg shadow-xl min-w-[200px] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-indigo-900/20 p-2 border-b border-indigo-500/30 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span className="text-zinc-200 font-bold text-xs tracking-wide">
                    {data.label || 'GROUP'}
                </span>
            </div>

            <div className="flex justify-between p-2 gap-4">
                {/* Inputs Column */}
                <div className="flex flex-col gap-3 relative">
                    {inputs.map((input, i) => (
                        <div key={input.id} className="relative flex items-center h-6">
                            <Handle
                                type="target"
                                position={Position.Left}
                                id={input.id}
                                className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-zinc-900 !-left-3"
                                style={{ top: '50%' }}
                            />
                            <span className="text-[10px] text-zinc-400 font-mono ml-1">
                                {input.label}
                            </span>
                        </div>
                    ))}
                    {inputs.length === 0 && <div className="text-[10px] text-zinc-600 italic">No Inputs</div>}
                </div>

                {/* Outputs Column */}
                <div className="flex flex-col gap-3 relative items-end">
                    {outputs.map((output, i) => (
                        <div key={output.id} className="relative flex items-center h-6 justify-end">
                            <span className="text-[10px] text-zinc-400 font-mono mr-1">
                                {output.label}
                            </span>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={output.id}
                                className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-zinc-900 !-right-3"
                                style={{ top: '50%' }}
                            />
                        </div>
                    ))}
                    {outputs.length === 0 && <div className="text-[10px] text-zinc-600 italic">No Outputs</div>}
                </div>
            </div>

            <div className="bg-zinc-900/50 p-1 text-center">
                <div className="text-[9px] text-zinc-500 uppercase tracking-widest">
                    Composite Node
                </div>
            </div>
        </div>
    );
}
