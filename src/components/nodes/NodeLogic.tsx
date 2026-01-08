import { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { NodeShell } from './NodeShell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';
import { useAppStore } from '@/store/useAppStore';
import { pullValue } from '@/engine/Brain';
import { useMuteLine, MuteLine } from './MuteVisual';

interface NodeLogicProps {
    id: string;
    data: { operation?: string; result?: number; error?: string; muted?: boolean };
}

export const NodeLogic = memo(({ id, data, selected, isConnectable }: NodeLogicProps & { selected?: boolean; isConnectable?: boolean }) => {
    const { updateNodeData, getNodes, getEdges } = useReactFlow();
    const { triggerLogicUpdate, logicVersion } = useAppStore();
    const operation = (data.operation as string) || 'AND';
    const [result, setResult] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isMuted = !!data.muted;

    // Use shared mute line logic
    const { containerRef, inputARef, outputRef, lineCoords } = useMuteLine(isMuted, [operation, selected]);

    // Unified Pull Logic for Preview
    useEffect(() => {
        const nodes = getNodes();
        const edges = getEdges();
        try {
            const pullResult = pullValue(id, nodes, edges);
            setResult(pullResult.val);
            setError(null);
        } catch (e: any) {
            setError(e.message || 'Error');
        }
    }, [logicVersion, id, getNodes, getEdges]);

    // Helper to get boolean state from result (0 = false, 1 = true)
    const isTrue = result === 1;
    const isFalse = result === 0;


    return (
        <NodeShell
            ref={containerRef}
            selected={selected}
            className={`bg-white border-2 border-indigo-500 rounded-xl shadow-lg min-w-[140px] hover:border-indigo-400 transition-all ${isMuted ? 'opacity-50 grayscale' : ''}`}
        >
            {/* Header */}
            <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex items-center justify-between rounded-t-[10px]">
                <div className="text-indigo-600 font-bold text-xs uppercase tracking-wider">LOGIC</div>
            </div>

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
                            className="-left-[13px]!"
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
                            className="-left-[13px]!"
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
                        <SelectTrigger className="h-7 bg-zinc-50 border-zinc-200 text-xs text-indigo-700 font-bold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-zinc-200">
                            <SelectItem value="AND" className="text-indigo-700 text-xs font-bold focus:bg-indigo-50">AND</SelectItem>
                            <SelectItem value="OR" className="text-indigo-700 text-xs font-bold focus:bg-indigo-50">OR</SelectItem>
                            <SelectItem value="XOR" className="text-indigo-700 text-xs font-bold focus:bg-indigo-50">XOR</SelectItem>
                            <SelectItem value="NAND" className="text-indigo-700 text-xs font-bold focus:bg-indigo-50">NAND</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>



            <div className="bg-zinc-50 p-2 flex items-center justify-end relative h-8 z-10 rounded-b-[10px] border-t border-zinc-100">
                <span className={`font-mono text-lg mr-2 font-bold ${isTrue ? 'text-indigo-600' : 'text-zinc-400'}`}>
                    {isFalse ? 'False' : isTrue ? 'True' : '-'}
                </span>
                <SourceHandle
                    ref={outputRef}
                    position={Position.Right}
                    id="output"
                    isConnectable={isConnectable}
                    className="right-0!"
                    color="indigo"
                />
            </div>

            {/* Error Display */}
            {error && (
                <div className="absolute bottom-full left-0 w-full bg-red-500/90 text-white text-[10px] p-1 text-center truncate rounded-t">
                    {error}
                </div>
            )}

            {/* Muted Pass-through Visual */}
            <MuteLine coords={lineCoords} color="#6366f1" />
        </NodeShell>
    );
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));

NodeLogic.displayName = 'NodeLogic';
