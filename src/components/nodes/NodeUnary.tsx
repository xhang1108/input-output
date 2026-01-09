'use client';

import { Handle, Position, useReactFlow, useStoreApi } from '@xyflow/react';
import { useState, memo, useEffect } from 'react';
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
import { ResultPreview } from './ResultPreview';

interface NodeUnaryProps {
    id: string;
    data: { operation?: string; result?: number; error?: string; muted?: boolean };
}

const operations = [
    { value: 'sqrt', label: '√' },
    { value: 'sin', label: 'sin' },
    { value: 'cos', label: 'cos' },
    { value: 'tan', label: 'tan' },
    { value: 'abs', label: 'abs' },
    { value: 'log', label: 'log' },
    { value: 'round', label: 'round' },
];

export const NodeUnary = memo(({ id, data, selected }: NodeUnaryProps & { selected?: boolean }) => {
    const { updateNodeData, getNodes, getEdges } = useReactFlow();
    const { triggerLogicUpdate, logicVersion } = useAppStore();
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
            className={`bg-zinc-200 border-2 border-purple-500 rounded-lg p-3 min-w-[120px] ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <div className="text-xs text-purple-500 mb-2 font-bold uppercase tracking-wider">
                Trig / Math
            </div>

            <Select value={op} onValueChange={onSelect}>
                <SelectTrigger className="w-full nodrag">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {operations.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                            {o.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Result Display */}
            <ResultPreview result={result} error={error} className="mt-0 pt-2" />

            <TargetHandle
                ref={inputARef}
                nodeId={id}
                position={Position.Left}
                id="inputA"
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
