import { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Box } from 'lucide-react';
import { NodeShell } from './NodeShell';
import { NodeHeader } from './NodeHeader';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';

interface MacroData extends Record<string, unknown> {
    // Nested Graph State
    nodes: Node[];
    edges: any[];

    // Interface Definitions (Ports)
    inputs: Array<{
        id: string;      // This matches the handle ID
        label: string;
        type: 'number' | 'matrix';
    }>;
    outputs: Array<{
        id: string;      // This matches the handle ID
        label: string;
    }>;
    label?: string;
}

export const NodeMacro = ({ id, data, selected }: NodeProps<Node<MacroData>>) => {
    return (
        <NodeShell
            selected={selected}
            className={cn(
                "bg-zinc-900 border-zinc-700 min-w-[140px] p-0 flex flex-col rounded-xl overflow-visible",
                selected && "border-amber-400"
            )}
        >
            {/* Header: Inset Style */}
            <NodeHeader
                label={data.label || 'Macro'}
                icon={<Box className="w-4 h-4 text-amber-500" />}
                className="px-4 pt-4 pb-2 w-full bg-transparent mb-0"
                textColor="text-zinc-100"
            />

            {/* Body */}
            <div className="pb-4 w-full flex justify-between gap-8 relative">
                {/* Inputs (Left) */}
                <div className="flex flex-col gap-4 w-full mt-1">
                    {data.inputs?.map((input) => (
                        <div key={input.id} className="relative flex items-center h-5 w-full">
                            <TargetHandle
                                nodeId={id}
                                id={input.id}
                                position={Position.Left}
                                style={{ top: '50%' }}
                                className="bg-amber-400! border-zinc-900!"
                            />
                            <span className="text-[10px] font-mono text-zinc-400 ml-2">
                                {input.label}
                            </span>
                        </div>
                    ))}
                    {/* Outputs (Right) */}
                    {data.outputs?.map((output) => (
                        <div key={output.id} className="relative flex items-center h-5 justify-end w-full">
                            <span className="text-[10px] font-mono text-zinc-400 mr-2">
                                {output.label}
                            </span>
                            <SourceHandle
                                id={output.id}
                                position={Position.Right}
                                style={{ top: '50%' }}
                                color="blue"
                            />
                        </div>
                    ))}

                    {(!data.inputs?.length && !data.outputs?.length) && (
                        <div className="text-[10px] text-zinc-600 italic text-center w-full">Empty Macro</div>
                    )}
                </div>
            </div>
            {/* Footer / Status */}
            {selected && (
                <div className="px-3 py-1 bg-zinc-950/50 border-t border-zinc-800 text-[9px] text-zinc-500 font-mono text-center">
                    SUBGRAPH
                </div>
            )}
        </NodeShell>
    );
};
