import { memo, useState, useRef, useEffect } from 'react';
import { NodeProps, Position, useReactFlow, useUpdateNodeInternals, useNodeConnections, useEdges, useStore, ReactFlowState, Edge } from '@xyflow/react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NodeHandle } from './NodeHandle';
import { HandleConfig, getHandleColor } from '../../types/NodeDefinition';
import { NODE_DEFINITIONS } from '../../definitions/nodeDefinitions';
import { useCapsulePreview } from '../edges/capsulePreviewState';
import { calculateCapsuleHeight } from '../../utils/handleUtils';

// Re-export HandleConfig for backward compatibility
export type { HandleConfig } from '../../types/NodeDefinition';
import { SingleHandle } from './SingleHandle';
import { CapsuleHandle } from './CapsuleHandle';

const DynamicNodeHandle = memo(({ h, id, isConnectable }: { h: HandleConfig, id: string, isConnectable: boolean }) => {
    if (h.variant === 'capsule') {
        return <CapsuleHandle h={h} id={id} isConnectable={isConnectable} />;
    }
    return <SingleHandle h={h} id={id} isConnectable={isConnectable} />;
});
DynamicNodeHandle.displayName = 'DynamicNodeHandle';

export const BaseNode = memo(({ id, data, selected, isConnectable, children, type, style }: NodeProps & { children?: React.ReactNode, style?: React.CSSProperties }) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [title, setTitle] = useState((data.label as string) || 'Node');
    const inputRef = useRef<HTMLInputElement>(null);
    const { updateNodeData } = useReactFlow();
    const updateNodeInternals = useUpdateNodeInternals();
    const allEdges = useEdges();
    const connections = allEdges.filter((e: Edge) => e.source === id || e.target === id);
    const preview = useCapsulePreview();

    // Find definition for fallback handles
    const definition = NODE_DEFINITIONS.find((d) => d.id === type);

    // Sync edges when handles change (Dynamic Layout)
    useEffect(() => {
        updateNodeInternals(id);
    }, [id, data.handles, updateNodeInternals]);

    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenaming]);

    const handleRename = () => {
        setIsRenaming(true);
    };

    const handleSubmit = () => {
        setIsRenaming(false);
        updateNodeData(id, { label: title });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit();
    };

    // ─── Smart Layout Constants ──────────────────────────────
    const NODE_LAYOUT = {
        headerH: 52, // Match --node-header-h
        socketGap: 8,
        socketSize: 12,
    };

    // Separate handles by position
    // Priority: 1. Dynamic handles from data | 2. Definition handles | 3. DEFAULT_HANDLES
    const allHandles = (data.handles as HandleConfig[]) || definition?.handles || [
        { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'scalar' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' },
    ];
    const leftHandles = allHandles.filter(h => h.position === Position.Left);
    const rightHandles = allHandles.filter(h => h.position === Position.Right);

    // Calculate dynamic node height based on handles
    const getHandleHeight = (h: HandleConfig) => {
        if (h.variant === 'capsule') {
            const isPreviewing = preview.active && preview.nodeId === id && preview.handleId === h.id;
            const handleConnections = connections.filter((conn: Edge) =>
                (h.type === 'target' ? conn.targetHandle === h.id : conn.sourceHandle === h.id)
            );
            const count = handleConnections.length + (isPreviewing ? 1 : 0);
            return calculateCapsuleHeight(count);
        }
        return NODE_LAYOUT.socketSize;
    };

    const calculateSideHeight = (handles: HandleConfig[]) => {
        if (handles.length === 0) return 0;
        const totalHandleHeight = handles.reduce((sum, h) => sum + getHandleHeight(h), 0);
        const totalGapHeight = (handles.length - 1) * NODE_LAYOUT.socketGap;
        return totalHandleHeight + totalGapHeight + 24; // 24 for top/bottom padding (pt-3 and buffer)
    };

    const minHeight = Math.max(
        60,
        Math.max(calculateSideHeight(leftHandles), calculateSideHeight(rightHandles)) + NODE_LAYOUT.headerH
    );

    /**
     * Calculate Y position for a handle or bypass line anchor relative to body section.
     */
    const calculateY = (index: number, total: number) => {
        if (total === 1) return `calc(${NODE_LAYOUT.headerH}px + (100% - ${NODE_LAYOUT.headerH}px) / 2)`;
        return `calc(${NODE_LAYOUT.headerH}px + ${index * (NODE_LAYOUT.socketSize + NODE_LAYOUT.socketGap) + NODE_LAYOUT.socketSize / 2}px)`;
    };

    return (
        <div
            className={`
                relative min-w-(--node-width-min) rounded-xl border transition duration-200 group
                ${selected
                    ? 'border-zinc-400 animate-ring-pulse'
                    : 'border-zinc-700 hover:border-zinc-500'}
                ${data.muted ? 'opacity-40 grayscale-40 shadow-none!' : 'node-shadow-1'}
            `}
            style={{ minHeight: `${minHeight}px`, background: 'var(--node-bg)', ...style }}
        >
            {/* Muted Bypass Visual */}
            {!!data.muted && (
                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-xl">
                    <svg className="w-full h-full">
                        <line
                            x1="0"
                            y1={calculateY(0, leftHandles.length)}
                            x2="100%"
                            y2={calculateY(0, rightHandles.length)}
                            stroke="var(--color-scalar)"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                            className="animate-mute-bypass opacity-60"
                        />
                    </svg>
                </div>
            )}

            {/* Header */}
            <div
                className="px-3 py-2 border-b border-zinc-800/60 rounded-t-xl flex items-center justify-between"
                style={{ background: 'var(--node-bg-header)' }}
                onDoubleClick={handleRename}
            >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {isRenaming ? (
                        <input
                            ref={inputRef}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={handleSubmit}
                            onKeyDown={handleKeyDown}
                            className="bg-transparent text-xs font-bold text-zinc-200 outline-none w-full"
                        />
                    ) : (
                        <span className="text-xs font-bold text-zinc-300 select-none truncate">{title}</span>
                    )}
                    {!!data.muted && (
                        <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1 rounded uppercase tracking-tighter font-black border border-zinc-700/50 leading-tight">Muted</span>
                    )}
                </div>

                {/* Visual Hint for Editable */}
                {!isRenaming && (
                    <Pencil className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                )}
            </div>

            {/* Content Body */}
            <div className="p-3">
                {children ? children : (
                    <div className="text-[10px] text-zinc-500 font-mono">ID: {id}</div>
                )}
            </div>

            {/* ─── Left Handles (Targets/Inputs) ───────────────── */}
            <div className="absolute left-0 w-0 bottom-0 flex flex-col items-center justify-start pt-3" style={{ top: `${NODE_LAYOUT.headerH}px`, gap: `${NODE_LAYOUT.socketGap}px` }}>
                {leftHandles.map((h) => (
                    <DynamicNodeHandle key={h.id} h={h} id={id} isConnectable={isConnectable} />
                ))}
            </div>

            {/* ─── Right Handles (Sources/Outputs) ─────────────── */}
            <div className="absolute right-0 w-0 bottom-0 flex flex-col items-center justify-start pt-3" style={{ top: `${NODE_LAYOUT.headerH}px`, gap: `${NODE_LAYOUT.socketGap}px` }}>
                {rightHandles.map((h) => (
                    <DynamicNodeHandle key={h.id} h={h} id={id} isConnectable={isConnectable} />
                ))}
            </div>
        </div>
    );
});

BaseNode.displayName = 'BaseNode';
