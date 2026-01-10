import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { NodeShell } from './NodeShell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';
import { pullValue } from '@/engine/Brain';
import { useMuteLine, MuteLine } from './MuteVisual';
import { useNodeResult } from './useNodeResult';
import { NodeHeader } from './NodeHeader';

const operations = [
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
];
interface NodeCompareProps {
    id: string;
    data: { operation?: string; result?: number; error?: string; muted?: boolean };
}

export const NodeCompare = memo(({ id, data, selected, isConnectable }: NodeCompareProps & { selected?: boolean; isConnectable?: boolean }) => {
    const { updateNodeData, getNodes, getEdges } = useReactFlow();
    const { triggerLogicUpdate, logicVersion } = useAppStore();
    const { result, error } = useNodeResult(id);
    const operation = (data.operation as string) || 'eq';
    const isMuted = !!data.muted;

    // Use shared mute line logic
    const { containerRef, inputARef, outputRef, lineCoords } = useMuteLine(isMuted, [operation, selected]);

    // Helper to get boolean state from result
    const isTrue = result === 1;
    const isFalse = result === 0;
    const isError = !!error;

    return (
        <NodeShell
            ref={containerRef}
            selected={selected}
            className={`bg-white border-2 border-teal-500 rounded-xl shadow-lg min-w-[140px] hover:border-teal-400 transition-all ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            {/* Header */}
            <NodeHeader
                label="Compare"
                statusIndicator={isError ? 'error' : isTrue ? 'success' : isFalse ? 'neutral' : 'neutral'}
                statusCustomColor={isFalse ? '#fee2e2' : undefined}
                className="bg-teal-50 px-4 py-2 border-b border-teal-100 rounded-t-[10px] mb-0"
                textColor="text-teal-600"
            />

            {/* Inputs */}
            <div className="p-3 space-y-3 relative">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between relative h-5">
                        <TargetHandle
                            ref={inputARef}
                            nodeId={id}
                            position={Position.Left}
                            id="inputA"
                            isConnectable={isConnectable}
                            className="-left-[17px]!"
                            style={{ top: '50%' }}
                        />
                        <span className="text-zinc-600 text-xs ml-2 font-bold">A</span>
                    </div>

                    <div className="flex items-center justify-between relative h-5">
                        <TargetHandle
                            nodeId={id}
                            position={Position.Left}
                            id="inputB"
                            isConnectable={isConnectable}
                            className="-left-[17px]!"
                            style={{ top: '50%' }}
                        />
                        <span className="text-zinc-600 text-xs ml-2 font-bold">B</span>
                    </div>
                </div>

                {/* Operation Select */}
                <div className="nodrag">
                    <Select
                        defaultValue={operation}
                        onValueChange={(val) => {
                            updateNodeData(id, { operation: val });
                            triggerLogicUpdate();
                        }}
                    >
                        <SelectTrigger className="h-7 bg-zinc-50 border-zinc-200 text-xs text-teal-700 font-bold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-zinc-200">
                            {operations.map(op => (
                                <SelectItem key={op.value} value={op.value} className="text-teal-700 text-xs font-bold focus:bg-teal-50 focus:text-teal-900">
                                    {op.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>



            {/* Output */}
            <div className="bg-zinc-50 p-2 flex items-center justify-end relative h-8 rounded-b-[10px] border-t border-zinc-100">
                <span className={`font-mono text-lg mr-2 font-bold transition-colors duration-300 ${isTrue ? 'text-green-600' : 'text-zinc-400'
                    }`}>
                    {isTrue ? 'TRUE' : isFalse ? 'FALSE' : '-'}
                </span>
                <SourceHandle
                    ref={outputRef}
                    position={Position.Right}
                    id="output"
                    isConnectable={isConnectable}
                    className="-right-[7px]! bg-teal-500! border-teal-500!"
                    color="green"
                />
            </div>

            {/* Error Display */}
            {error && (
                <div className="absolute bottom-full left-0 w-full bg-red-500/90 text-white text-[10px] p-1 text-center truncate rounded-t">
                    {error}
                </div>
            )}

            {/* Muted Pass-through Visual */}
            <MuteLine coords={lineCoords} color="#14b8a6" />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));

NodeCompare.displayName = 'NodeCompare';
