import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';

export const NodeLogic = memo(({ id, data, isConnectable }: NodeProps) => {
    const { updateNodeData } = useReactFlow();
    const operation = (data.operation as string) || 'AND';
    const rawResult = data.result as any;
    const error = data.error as string | undefined;

    // Helper to get boolean state from result (0 = false, 1 = true)
    let isTrue = false;
    let isFalse = false;
    if (rawResult !== undefined) {
        // Handle BigNumber or primitive
        const num = typeof rawResult === 'object' && rawResult.toNumber ? rawResult.toNumber() : Number(rawResult);
        if (num === 1) isTrue = true;
        if (num === 0) isFalse = true;
    }

    return (
        <div className="bg-zinc-900 border-2 border-indigo-500/50 rounded-xl shadow-lg min-w-[140px]">
            {/* Header */}
            <div className="bg-indigo-500/20 px-4 py-2 border-b border-indigo-500/30 flex items-center justify-between rounded-t-[10px]">
                <div className="text-indigo-400 font-bold text-xs uppercase tracking-wider">LOGIC</div>
            </div>

            {/* Inputs */}
            <div className="p-3 space-y-3 relative">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between relative h-5">
                        <TargetHandle
                            nodeId={id}
                            position={Position.Left}
                            id="inputA"
                            isConnectable={isConnectable}
                            className="!-left-[13px]"
                        />
                        <span className="text-zinc-500 text-xs ml-2">A</span>
                    </div>

                    <div className="flex items-center justify-between relative h-5">
                        <TargetHandle
                            nodeId={id}
                            position={Position.Left}
                            id="inputB"
                            isConnectable={isConnectable}
                            className="!-left-[13px]"
                        />
                        <span className="text-zinc-500 text-xs ml-2">B</span>
                    </div>
                </div>

                {/* Operation Select */}
                <div className="nodrag">
                    <Select
                        defaultValue={operation}
                        onValueChange={(val) => {
                            updateNodeData(id, { operation: val });
                        }}
                    >
                        <SelectTrigger className="h-7 bg-zinc-800 border-zinc-700 text-xs text-indigo-300">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                            <SelectItem value="AND" className="text-indigo-300 text-xs">AND</SelectItem>
                            <SelectItem value="OR" className="text-indigo-300 text-xs">OR</SelectItem>
                            <SelectItem value="XOR" className="text-indigo-300 text-xs">XOR</SelectItem>
                            <SelectItem value="NAND" className="text-indigo-300 text-xs">NAND</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-zinc-950/50 p-2 flex items-center justify-end relative h-8 z-10 rounded-b-[10px]">
                <span className="text-indigo-400 font-mono text-xl mr-2">
                    {isFalse ? 'False' : isTrue ? 'True' : '-'}
                </span>
                <SourceHandle
                    position={Position.Right}
                    id="output"
                    isConnectable={isConnectable}
                    className="!-right-[0px]"
                    color="indigo"
                />
            </div>

            {/* Error Display */}
            {error && (
                <div className="absolute bottom-full left-0 w-full bg-red-500/90 text-white text-[10px] p-1 text-center truncate">
                    {error}
                </div>
            )}
        </div>
    );
});

NodeLogic.displayName = 'NodeLogic';
