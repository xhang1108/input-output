'use client';
import { cn } from '@/lib/utils';

import { Handle, Position, useReactFlow, useStoreApi } from '@xyflow/react';
import { useState, memo, useEffect, useRef } from 'react';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import { pullValue } from '@/engine/Brain';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/useAppStore';
import { useMuteLine, MuteLine } from './MuteVisual';
import { useNodeResult } from './useNodeResult';
import { NodeHeader } from './NodeHeader';
import { ResultPreview } from './ResultPreview';

interface NodeMathProps {
    id: string;
    data: { operation?: string; result?: number; error?: string; muted?: boolean };
}

const operations = [
    { value: 'add', label: '+' },
    { value: 'sub', label: '−' },
    { value: 'mul', label: '×' },
    { value: 'div', label: '÷' },
    { value: 'pow', label: '^' },
    { value: 'mod', label: '%' },
];

import { useRenderTracker } from '../debug/Profiler';

import { NodeOperationSelect } from './NodeOperationSelect';

export const NodeMath = memo(({ id, data, selected }: NodeMathProps & { selected?: boolean }) => {
    useRenderTracker('NodeMath');
    const { updateNodeData } = useReactFlow();
    const { triggerLogicUpdate } = useAppStore();
    const [op, setOp] = useState(data.operation || 'add');
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
            className={`bg-white border-2 border-orange-500 rounded-xl min-w-[140px] p-3 hover:border-orange-400 transition-all flex flex-col ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            {/* Header: Inset Style */}
            <NodeHeader
                label="Arithmetic"
                className="mb-2 w-full"
                textColor="text-orange-600"
            />
            <div className="flex flex-col items-center gap-3">
                <div className="w-full flex justify-center">
                    <NodeOperationSelect
                        value={op}
                        options={operations}
                        onValueChange={onSelect}
                        colorTheme="orange"
                        variant="hero"
                        valueClassName={(val) => cn(
                            val === 'pow' ? "top-[4px]" :
                                val === 'mod' ? "top-[-2px]" :
                                    "top-[-4px]"
                        )}
                    />
                </div>

                {/* Result Display */}
                <ResultPreview result={result} error={error} className="border-t-0 mt-0 pt-0 text-orange-600 font-bold" />
            </div>

            <TargetHandle
                ref={inputARef}
                nodeId={id}
                position={Position.Left}
                id="inputA"
                style={{ top: '45%' }}
            />
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputB"
                style={{ top: '65%' }}
            />



            <SourceHandle
                ref={outputRef}
                position={Position.Right}
                id="output"
                color="orange"
            />

            {/* Muted Pass-through Visual */}
            <MuteLine coords={lineCoords} color="#f97316" opacity={0.8} />
        </NodeShell >
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));
