'use client';

import { Handle, Position, useReactFlow } from '@xyflow/react';
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

export const NodeMath = memo(({ id, data, selected }: NodeMathProps & { selected?: boolean }) => {
    const { updateNodeData, getNodes, getEdges } = useReactFlow();
    const { triggerLogicUpdate, logicVersion } = useAppStore();
    const [op, setOp] = useState(data.operation || 'add');
    const [result, setResult] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isMuted = !!data.muted;

    // Use shared mute line logic
    const { containerRef, inputARef, outputRef, lineCoords } = useMuteLine(isMuted, [op, selected]);

    // Unified Pull Logic for Preview
    useEffect(() => {
        const nodes = getNodes();
        const edges = getEdges();
        try {
            const pullResult = pullValue(id, nodes, edges);
            setResult(pullResult.val);
            setError(null);
        } catch (e) {
            setError('Error');
        }
    }, [logicVersion, id, getNodes, getEdges]);

    const onSelect = (value: string) => {
        setOp(value);
        updateNodeData(id, { operation: value });
        triggerLogicUpdate();
    };

    const currentLabel = operations.find((o) => o.value === op)?.label || '+';

    return (
        <NodeShell
            ref={containerRef}
            selected={selected}
            className={`bg-white border-2 border-orange-400 rounded-full w-[80px] h-[80px] shadow-lg flex flex-col items-center justify-center relative hover:border-orange-500 transition-all ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            <TargetHandle
                ref={inputARef}
                nodeId={id}
                position={Position.Left}
                id="inputA"
                style={{ top: '30%' }}
            />
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputB"
                style={{ top: '70%' }}
            />


            <Select value={op} onValueChange={onSelect}>
                <SelectTrigger className="w-12 h-12 border-none bg-transparent text-3xl font-bold text-orange-500 justify-center nodrag [&>svg]:hidden">
                    <SelectValue>{currentLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {operations.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                            <span className="text-lg font-bold">{o.label}</span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Result Display */}
            {error ? (
                <span className="text-red-500 text-xs text-center font-bold">⚠️ Error</span>
            ) : (
                <span className="text-zinc-600 font-mono font-bold text-xs">
                    {(() => {
                        if (result === null) return '...';
                        if (typeof result === 'number' && !isNaN(result)) {
                            return result.toLocaleString('en-US', {
                                maximumFractionDigits: 2,
                                useGrouping: true
                            });
                        }
                        return '...';
                    })()}
                </span>
            )}



            <SourceHandle
                ref={outputRef}
                position={Position.Right}
                color="orange"
            />

            {/* Muted Pass-through Visual */}
            <MuteLine coords={lineCoords} color="#f97316" opacity={0.8} />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));
