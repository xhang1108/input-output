import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';

const operations = [
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
];

export const NodeCompare = memo(({ id, data, isConnectable }: NodeProps) => {
    const { updateNodeData } = useReactFlow();
    const operation = (data.operation as string) || 'eq';
    const rawResult = data.result as any;
    const error = data.error as string | undefined;

    // Helper to get boolean state from result
    let isTrue = false;
    let isFalse = false;
    if (rawResult !== undefined) {
        // Handle BigNumber or primitive
        const num = typeof rawResult === 'object' && rawResult.toNumber ? rawResult.toNumber() : Number(rawResult);
        if (num === 1) isTrue = true;
        if (num === 0) isFalse = true;
    }

    const isError = !!error;

    return (
        <div className="bg-zinc-900 border-2 border-teal-500/50 rounded-xl shadow-lg min-w-[140px]">
            {/* Header */}
            <div className="bg-teal-500/20 px-4 py-2 border-b border-teal-500/30 flex items-center justify-between rounded-t-[10px]">
                <div className="text-teal-400 font-bold text-xs uppercase tracking-wider">COMPARE</div>

                {/* LED Indicator */}
                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] transition-colors duration-300 ${isError ? 'bg-red-500 text-red-500' :
                    isTrue ? 'bg-green-500 text-green-500' :
                        isFalse ? 'bg-red-900/50 text-red-900 border border-red-700/50' :
                            'bg-zinc-700 text-zinc-700'
                    }`} />
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
                            className="!-left-[17px]"
                        />
                        <span className="text-zinc-500 text-xs ml-2">A</span>
                    </div>

                    <div className="flex items-center justify-between relative h-5">
                        <TargetHandle
                            nodeId={id}
                            position={Position.Left}
                            id="inputB"
                            isConnectable={isConnectable}
                            className="!-left-[17px]"
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
                        <SelectTrigger className="h-7 bg-zinc-800 border-zinc-700 text-xs text-teal-300 font-bold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                            {operations.map(op => (
                                <SelectItem key={op.value} value={op.value} className="text-teal-300 text-xs font-bold">
                                    {op.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Output */}
            <div className="bg-zinc-950/50 p-2 flex items-center justify-end relative h-8 rounded-b-[10px]">
                <span className={`font-mono text-xl mr-2 transition-colors duration-300 ${isTrue ? 'text-green-400' : 'text-zinc-600'
                    }`}>
                    {isTrue ? 'TRUE' : isFalse ? 'FALSE' : '-'}
                </span>
                <SourceHandle
                    position={Position.Right}
                    id="output"
                    isConnectable={isConnectable}
                    className="!-right-[7px] !bg-teal-500 !border-teal-500"
                    color="green"
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

NodeCompare.displayName = 'NodeCompare';
