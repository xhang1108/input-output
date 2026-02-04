'use client';

import { memo } from 'react';
import { Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';
import { NodeShell } from './NodeShell';
import { useMuteLine, MuteLine } from './MuteVisual';
import { useNodeResult } from './useNodeResult';
import { ResultPreview } from './ResultPreview';
import { NodeHeader } from './NodeHeader';

export const NodeSwitch = memo(({ id, data, selected, isConnectable }: NodeProps) => {
    const { triggerLogicUpdate } = useAppStore();
    const { result, error } = useNodeResult(id);
    const isMuted = !!data.muted;

    // In NodeSwitch, mute pass-through is ifFalse -> Output
    const { containerRef, inputARef: inputFalseRef, outputRef, lineCoords } = useMuteLine(isMuted, [selected]);

    return (
        <NodeShell
            ref={containerRef}
            selected={selected}
            className={`bg-white border-2 border-indigo-500 rounded-xl min-w-[160px] p-3 hover:border-indigo-400 transition-all ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <NodeHeader
                label="Switch / If"
                className="mb-2 w-full"
                textColor="text-indigo-600"
            />

            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between h-5">
                        <span className="text-indigo-600 text-[10px] pl-4 font-bold uppercase">Condition</span>
                    </div>

                    <div className="flex items-center justify-between h-5">
                        <span className="text-green-600 text-[10px] pl-4 font-bold uppercase">If True</span>
                    </div>

                    <div className="flex items-center justify-between h-5">
                        <span className="text-red-600 text-[10px] pl-4 font-bold uppercase">If False</span>
                    </div>
                </div>

                <div className="w-full bg-indigo-50 rounded-lg p-2.5 flex items-center justify-center border border-indigo-100 shadow-inner mt-2">
                    <ResultPreview result={result} error={error} precision={4} className="border-0 m-0 p-0 text-sm font-bold" />
                </div>
            </div>

            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="condition"
                isConnectable={isConnectable}
                style={{ top: '33%' }}
                className="bg-indigo-400!"
            />

            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="ifTrue"
                isConnectable={isConnectable}
                style={{ top: '51.5%' }}
                className="bg-green-400!"
            />

            <TargetHandle
                ref={inputFalseRef}
                nodeId={id}
                position={Position.Left}
                id="ifFalse"
                isConnectable={isConnectable}
                style={{ top: '69%' }}
                className="bg-red-400!"
            />



            <SourceHandle
                ref={outputRef}
                position={Position.Right}
                id="output"
                isConnectable={isConnectable}
                className="bg-indigo-500! border-indigo-500!"
                style={{ top: '91%' }}
            />

            <MuteLine coords={lineCoords} color="#6366f1" />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));

NodeSwitch.displayName = 'NodeSwitch';
