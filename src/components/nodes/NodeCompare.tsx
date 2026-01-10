'use client';
import { memo } from 'react';
import { Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';
import { useMuteLine, MuteLine } from './MuteVisual';
import { useNodeResult } from './useNodeResult';
import { NodeHeader } from './NodeHeader';
import { BooleanPreview } from './BooleanPreview';
import { NodeOperationSelect } from './NodeOperationSelect';

const operations = [
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
];

type NodeCompareData = {
    operation?: string;
    result?: number;
    error?: string;
    muted?: boolean;
};

export const NodeCompare = memo(({ id, data, selected, isConnectable }: NodeProps & { selected?: boolean; isConnectable?: boolean }) => {
    const { updateNodeData } = useReactFlow();
    const { triggerLogicUpdate } = useAppStore();
    const { result, error } = useNodeResult(id);
    const compareData = data as NodeCompareData;
    const operation = compareData.operation || 'eq';
    const isMuted = !!compareData.muted;

    const { containerRef, inputARef, outputRef, lineCoords } = useMuteLine(isMuted, [operation, selected]);

    return (
        <NodeShell
            ref={containerRef}
            selected={selected}
            className={`bg-white border-2 border-teal-500 rounded-xl shadow-lg min-w-[140px] p-3 hover:border-teal-400 transition-all ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <NodeHeader
                label="Compare"
                className="mb-2 w-full"
                textColor="text-teal-600"
            />

            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 w-full">
                    <div className="flex items-center justify-between h-5">
                        <span className="text-zinc-600 text-xs pl-4 font-bold uppercase tracking-tight">Input A</span>
                    </div>

                    <div className="flex items-center justify-between h-5">
                        <span className="text-zinc-600 text-xs pl-4 font-bold uppercase tracking-tight">Input B</span>
                    </div>
                </div>

                <div className="w-full flex justify-center mt-2">
                    <NodeOperationSelect
                        value={operation}
                        options={operations}
                        onValueChange={(val) => {
                            updateNodeData(id, { operation: val });
                            triggerLogicUpdate();
                        }}
                        colorTheme="teal"
                        variant="hero"
                        valueClassName={() => "top-[-4px]"}
                    />
                </div>

                <div className="w-full bg-teal-50 rounded-lg p-2.5 flex items-center justify-center border border-teal-100 shadow-inner">
                    <BooleanPreview value={result === 1 ? true : result === 0 ? false : null} error={error} />
                </div>
            </div>

            <TargetHandle
                ref={inputARef}
                nodeId={id}
                position={Position.Left}
                id="inputA"
                isConnectable={isConnectable}
                style={{ top: '31.5%' }}
            />

            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputB"
                isConnectable={isConnectable}
                style={{ top: '47%' }}
            />



            <SourceHandle
                ref={outputRef}
                position={Position.Right}
                id="output"
                isConnectable={isConnectable}
                color="green"
                style={{ top: '93%' }}
            />

            <MuteLine coords={lineCoords} color="#14b8a6" />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));

NodeCompare.displayName = 'NodeCompare';
