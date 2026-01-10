'use client';

import { Position, useReactFlow } from '@xyflow/react';
import { useState, memo } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';
import { useMuteLine, MuteLine } from './MuteVisual';
import { useNodeResult } from './useNodeResult';
import { NodeHeader } from './NodeHeader';
import { ResultPreview } from './ResultPreview';
import { NodeOperationSelect } from './NodeOperationSelect';

interface NodeUnaryProps {
    id: string;
    data: { operation?: string; result?: number; error?: string; muted?: boolean };
}

const operations = [
    { value: 'abs', label: '|x|' },
    { value: 'sqrt', label: '√' },
    { value: 'sin', label: 'sin' },
    { value: 'cos', label: 'cos' },
    { value: 'tan', label: 'tan' },
    { value: 'log', label: 'log' },
    { value: 'exp', label: 'exp' },
];

export const NodeUnary = memo(({ id, data, selected }: NodeUnaryProps & { selected?: boolean }) => {
    const { updateNodeData } = useReactFlow();
    const { triggerLogicUpdate } = useAppStore();
    const [op, setOp] = useState(data.operation || 'sqrt');
    const { result, error } = useNodeResult(id);
    const isMuted = !!data.muted;
    const { containerRef, inputARef, outputRef, lineCoords } = useMuteLine(isMuted, [op, selected]);

    const onSelect = (value: string) => {
        setOp(value);
        updateNodeData(id, { operation: value });
        triggerLogicUpdate();
    };

    return (
        <NodeShell
            ref={containerRef}
            selected={selected}
            className={`bg-white border-2 border-purple-500 rounded-xl min-w-[140px] p-3 hover:border-purple-400 transition-all flex flex-col ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <NodeHeader
                label="Function"
                className="mb-2 w-full"
                textColor="text-purple-600"
            />

            <div className="flex flex-col items-center gap-3">
                <NodeOperationSelect
                    value={op}
                    options={operations}
                    onValueChange={onSelect}
                    colorTheme="purple"
                    triggerClassName="w-16 h-16 text-3xl font-black rounded-2xl [&>svg]:hidden p-0"
                    valueClassName={() => "relative top-[-4px]"}
                />

                {/* Result Display */}
                <ResultPreview result={result} error={error} className="border-t-0 mt-0 pt-0 text-purple-600 font-bold" />
            </div>

            <TargetHandle
                ref={inputARef}
                nodeId={id}
                position={Position.Left}
                id="inputA"
                style={{ top: '50%' }}
            />

            <SourceHandle
                ref={outputRef}
                position={Position.Right}
                id="output"
                color="purple"
            />

            {/* Muted Pass-through Visual */}
            <MuteLine coords={lineCoords} color="#a855f7" />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));

NodeUnary.displayName = 'NodeUnary';
