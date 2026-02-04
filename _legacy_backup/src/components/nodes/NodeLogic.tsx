'use client';
import { memo } from 'react';
import { Position, useReactFlow } from '@xyflow/react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';
import { useMuteLine, MuteLine } from './MuteVisual';
import { useNodeResult } from './useNodeResult';
import { NodeHeader } from './NodeHeader';
import { BooleanPreview } from './BooleanPreview';
import { NodeOperationSelect } from './NodeOperationSelect';

interface NodeLogicProps {
    id: string;
    data: { operation?: string; result?: number; error?: string; muted?: boolean };
}

const logicOptions = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' },
    { value: 'XOR', label: 'XOR' },
    { value: 'NAND', label: 'NAND' },
];

export const NodeLogic = memo(({ id, data, selected, isConnectable }: NodeLogicProps & { selected?: boolean; isConnectable?: boolean }) => {
    const { updateNodeData } = useReactFlow();
    const { triggerLogicUpdate } = useAppStore();
    const { result, error } = useNodeResult(id);
    const operation = (data.operation as string) || 'AND';
    const isMuted = !!data.muted;

    const { containerRef, inputARef, outputRef, lineCoords } = useMuteLine(isMuted, [operation, selected]);

    return (
        <NodeShell
            ref={containerRef}
            selected={selected}
            className={`bg-white border-2 border-indigo-500 rounded-xl shadow-lg min-w-[140px] p-3 hover:border-indigo-400 transition-all ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <NodeHeader
                label="Logic"
                className="mb-2 w-full"
                textColor="text-indigo-600"
            />

            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-4 w-full">
                    <div className="flex items-center justify-between h-5">
                        <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider pl-4">Signal A</span>
                    </div>

                    <div className="flex items-center justify-between h-5">
                        <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider pl-4">Signal B</span>
                    </div>
                </div>

                <div className="flex justify-center w-full">
                    <NodeOperationSelect
                        value={operation}
                        options={logicOptions}
                        onValueChange={(val) => {
                            updateNodeData(id, { operation: val });
                            triggerLogicUpdate();
                        }}
                        colorTheme="indigo"
                        variant="hero"
                        triggerClassName="min-w-[4rem] w-auto px-2 h-16 text-3xl font-black rounded-2xl [&>svg]:hidden"
                        valueClassName={() => "top-[-2px]"}
                    />
                </div>

                <div className="w-full bg-indigo-50 rounded-lg p-2.5 flex items-center justify-center border border-indigo-100 shadow-inner">
                    <BooleanPreview value={result === 1 ? true : result === 0 ? false : null} error={error} />
                </div>
            </div>

            <TargetHandle
                ref={inputARef}
                nodeId={id}
                position={Position.Left}
                id="inputA"
                isConnectable={isConnectable}
                style={{ top: '28%' }}
            />

            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputB"
                isConnectable={isConnectable}
                style={{ top: '42%' }}
            />

            <SourceHandle
                ref={outputRef}
                position={Position.Right}
                id="output"
                isConnectable={isConnectable}
                color="indigo"
                style={{ top: '85%' }}
            />

            <MuteLine coords={lineCoords} color="#6366f1" />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));

NodeLogic.displayName = 'NodeLogic';
