import { memo, useState, useRef, useEffect, useMemo, forwardRef } from 'react';
import { NodeProps, Position, useReactFlow, useUpdateNodeInternals, useNodeConnections, useEdges, useStore, ReactFlowState, Edge, NodeToolbar } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NodeHandle } from './NodeHandle';
import { HandleConfig } from '../../types/nodeDefinitions';
import { resolveHandlePosition, assertUniqueHandleIds } from '../../utils/handleUtils';
import { NODE_DEFINITIONS } from '@/types/nodeDefinitions';
import { useCapsulePreview } from '../edges/capsulePreviewState';
import { calculateCapsuleHeight } from '../../utils/handleUtils';
import { useHistoryStore } from '../../store/useHistoryStore';
import { getUniqueLabel } from '../../utils/labelUtils';
import { useAppStore } from '../../store/useStore';
import { useFrameActions } from '../../hooks/useFrameActions';

// Re-export HandleConfig for backward compatibility
export type { HandleConfig } from '../../types/nodeDefinitions';
import { SingleHandle } from './SingleHandle';
import { CapsuleHandle } from './CapsuleHandle';
import { StringInput } from '../common/StringInput';

const DynamicNodeHandle = memo(({ h, id, isConnectable, data }: { h: HandleConfig, id: string, isConnectable: boolean, data: any }) => {
    if (h.variant === 'capsule') {
        return <CapsuleHandle h={h} id={id} isConnectable={isConnectable} nodeData={data} />;
    }
    return <SingleHandle h={h} id={id} isConnectable={isConnectable} nodeData={data} />;
});
DynamicNodeHandle.displayName = 'DynamicNodeHandle';

export const BaseNode = memo(forwardRef<HTMLDivElement, NodeProps & { children?: React.ReactNode, style?: React.CSSProperties, hideDefaultHandles?: boolean, onDoubleClick?: (e: React.MouseEvent) => void, handleVariants?: Record<string, 'single' | 'capsule'> }>(({ id, data, selected, isConnectable, children, type, style, hideDefaultHandles, onDoubleClick, handleVariants }, ref) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [title, setTitle] = useState((data.label as string) || 'Node');
    const [isError, setIsError] = useState(false);
    const labelSetRef = useRef<Set<string>>(new Set());
    const inputRef = useRef<HTMLInputElement>(null);
    const { updateNodeData, setNodes, getEdges } = useReactFlow();
    const updateNodeInternals = useUpdateNodeInternals();
    const targetConnections = useNodeConnections({ handleType: 'target' });
    const sourceConnections = useNodeConnections({ handleType: 'source' });
    const connections = [...targetConnections, ...sourceConnections];
    const preview = useCapsulePreview();
    const pushHistory = useHistoryStore(s => s.push);
    const { detachNode } = useFrameActions();
    const parentId = useStore(s => s.nodeLookup.get(id)?.parentId);

    const definition = NODE_DEFINITIONS.find((d) => d.id === type);

    const categoryClass = useMemo(() => {
        const cat = definition?.category?.toLowerCase() || '';
        if (cat.includes('input')) return 'node-cat-input';
        if (cat.includes('output')) return 'node-cat-output';
        if (cat.includes('math')) return 'node-cat-math';
        if (cat.includes('calculus')) return 'node-cat-calculus';
        if (cat.includes('data')) return 'node-cat-data';
        if (cat.includes('transform')) return 'node-cat-transform';
        if (cat.includes('logic')) return 'node-cat-logic';
        if (cat.includes('utility')) return 'node-cat-utility';
        return '';
    }, [definition]);

    // Sync edges and internal state when data changes
    useEffect(() => {
        updateNodeInternals(id);
        if (data.label) setTitle(data.label as string);
    }, [id, data.handles, data.label, updateNodeInternals]);
    
    const isHighlighted = useAppStore(s => s.highlightedNodeIds.includes(id));

    // Visual State (Strict DOM Isolation)
    const brain = useBrain();
    const nodeLogic = brain.getNode(id);
    const visualState = nodeLogic?.visualState;

    // ─── Capsule Expansion Compensation (REMOVED) ───
    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenaming]);

    const handleRename = () => {
        // Performance: Pre-scan all current node labels into a Set (O(1) lookup during typing)
        const allLabels = Array.from(brain.getNodesMap().values())
            .filter(n => n.id !== id) // Exclude self
            .map(n => n.data?.label)
            .filter(l => typeof l === 'string' && l.trim() !== '') as string[];
        
        labelSetRef.current = new Set(allLabels.map(l => l.toLowerCase()));
        
        setIsError(false);
        setIsRenaming(true);
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const trimmed = val.trim();
        setTitle(val);

        // Validation: Empty or Duplicate
        const invalid = trimmed === '' || labelSetRef.current.has(trimmed.toLowerCase());
        setIsError(invalid);
    };

    const handleSubmit = () => {
        if (title.trim() === '') return;
        commitRename();
        setIsRenaming(false);
    };

    const commitRename = () => {
        const trimmed = title.trim();
        const currentLabel = (data.label as string) || '';

        if (trimmed === '') {
            setTitle(currentLabel);
            return;
        }

        // Performance: Use the pre-scanned labels from handleRename fallback or live scan
        // Actually, better to live scan to be safe
        const allLabels = Array.from(brain.getNodesMap().values())
            .filter(n => n.id !== id)
            .map(n => n.data?.label as string)
            .filter(Boolean);

        const finalizedLabel = getUniqueLabel(trimmed, allLabels);
        setTitle(finalizedLabel);

        if (finalizedLabel !== currentLabel) {
            const forwardTx = { type: 'UPDATE_NODE_DATA' as const, payload: { id, data: { label: finalizedLabel } } };
            const inverseTx = { type: 'UPDATE_NODE_DATA' as const, payload: { id, data: { label: currentLabel } } };

            // 1. APPLY TO BRAIN
            brain.applyTransaction(forwardTx);

            // 2. RECORD TO HISTORY
            pushHistory({
                id: `rename_${id}_${Date.now()}`,
                description: `Rename node: ${finalizedLabel}`,
                forward: [forwardTx],
                inverse: [inverseTx]
            });

            // 3. IMMEDIATE UI UPDATE
            updateNodeData(id, { label: finalizedLabel });
        }
    };

    const handleBlur = () => {
        commitRename();
        setIsError(false);
        setIsRenaming(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (title.trim() === '') {
                e.preventDefault();
            } else {
                handleSubmit();
            }
        } else if (e.key === 'Escape') {
            // Unconditional revert
            setTitle((data.label as string) || 'Node');
            setIsError(false);
            setIsRenaming(false);
        }
    };

    // ─── Smart Layout Constants ──────────────────────────────
    const NODE_LAYOUT = {
        headerH: 52, // Match --node-header-h
        socketGap: 8,
        socketSize: 12,
    };

    // Separate handles by position
    // Priority: 1. Dynamic handles from data | 2. Definition handles | 3. DEFAULT_HANDLES
    const rawHandles = (data.handles as HandleConfig[]) || definition?.handles || [
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'scalar' },
        { id: 'out_a', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' },
    ];

    // Apply prop-based handle overrides (Phase 3: Dynamic Shape)
    const allHandles = rawHandles.map(h => {
        if (handleVariants && handleVariants[h.id]) {
            return { ...h, variant: handleVariants[h.id] };
        }
        return h;
    }).filter(h => !h.hidden || !h.hidden(data));

    // P2-11 (dev-only): duplicate/empty handle ids fail fast here — BaseNode is
    // the only place with the full sibling list (Single/Capsule see one `h`).
    // RerouteNode bypasses BaseNode; its raw <Handle> ids are annotated there.
    if (process.env.NODE_ENV !== 'production') {
        assertUniqueHandleIds(allHandles, id);
    }

    const leftHandles = allHandles.filter(h => resolveHandlePosition(h) === Position.Left);
    const rightHandles = allHandles.filter(h => resolveHandlePosition(h) === Position.Right);

    // Calculate dynamic node height based on handles
    const getHandleHeight = (h: HandleConfig) => {
        if (h.variant === 'capsule') {
            const isPreviewing = preview.active && preview.nodeId === id && preview.handleId === h.id;
            const handleConnections = connections.filter((conn) =>
                (h.type === 'target' ? conn.targetHandle === h.id : conn.sourceHandle === h.id)
            );
            // If the new wire is already in React Flow's state, don't double count the preview wire
            const isAlreadyCommitted = isPreviewing && handleConnections.length >= preview.totalSlots;
            const count = handleConnections.length + (isPreviewing && !isAlreadyCommitted ? 1 : 0);
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
        definition?.minHeight || 60,
        Math.max(calculateSideHeight(leftHandles), calculateSideHeight(rightHandles)) + NODE_LAYOUT.headerH
    );



    // ─── Phase 4.3: Edge Cleanup (Ghost Link Prevention) ────────────────
    // When a handle becomes hidden (e.g. POW -> SQRT), we MUST explicitly 
    // disconnect any existing edges to that handle in the engine.
    useEffect(() => {
        const activeTargetHandleIds = new Set(leftHandles.map(h => h.id));
        const activeSourceHandleIds = new Set(rightHandles.map(h => h.id));

        const allEdges = getEdges();

        targetConnections.forEach(conn => {
            if (conn.targetHandle && !activeTargetHandleIds.has(conn.targetHandle)) {
                // Find the actual edge by matching the connection metadata
                const edge = allEdges.find(e => 
                    e.target === id && 
                    e.targetHandle === conn.targetHandle && 
                    e.source === conn.source && 
                    e.sourceHandle === conn.sourceHandle
                );
                if (edge) {
                    console.log(`[BaseNode] Auto-cleanup: Disconnecting hidden target handle ${conn.targetHandle} on node ${id}`);
                    brain.applyTransaction({ type: 'DISCONNECT', payload: edge.id });
                }
            }
        });

        sourceConnections.forEach(conn => {
            if (conn.sourceHandle && !activeSourceHandleIds.has(conn.sourceHandle)) {
                const edge = allEdges.find(e => 
                    e.source === id && 
                    e.sourceHandle === conn.sourceHandle && 
                    e.target === conn.target && 
                    e.targetHandle === conn.targetHandle
                );
                if (edge) {
                    console.log(`[BaseNode] Auto-cleanup: Disconnecting hidden source handle ${conn.sourceHandle} on node ${id}`);
                    brain.applyTransaction({ type: 'DISCONNECT', payload: edge.id });
                }
            }
        });
    }, [allHandles, id, brain, targetConnections, sourceConnections, leftHandles, rightHandles, getEdges]);

    /**
     * Calculate Y position for a specific handle or fallback to first.
     */
    const getHandleY = (handles: HandleConfig[], preferredIds: string[]) => {
        if (handles.length === 0) return `${NODE_LAYOUT.headerH + 20}px`; // Fixed top offset, no centering

        const target = handles.find(h => preferredIds.includes(h.id)) || handles[0];

        // Calculate cumulative offset
        let yOffset = 0;
        for (const h of handles) {
            if (h === target) break;
            yOffset += getHandleHeight(h) + NODE_LAYOUT.socketGap;
        }

        const handleHeight = getHandleHeight(target);
        return `calc(${NODE_LAYOUT.headerH}px + 12px + ${yOffset}px + ${handleHeight / 2}px)`;
    };

    return (
        <div
            ref={ref}
            className={cn(
                "relative rounded-xl border transition-colors duration-200 group flex flex-col",
                selected ? "border-zinc-400" : "border-zinc-700 hover:border-zinc-500",
                isHighlighted && "border-blue-400/80 shadow-[0_0_20px_rgba(59,130,246,0.3)]",
                categoryClass
            )}
            style={{
                minHeight: `${minHeight}px`,
                background: 'var(--node-bg)',
                opacity: data.muted ? 0.4 : 1,
                filter: data.muted ? 'grayscale(0.4)' : 'none',
                transformOrigin: '0 0',
                ...style
            }}
            onDoubleClick={onDoubleClick}
        >
            {parentId && (
                <NodeToolbar className="nodrag" position={Position.Top} offset={8}>
                    <button
                        type="button"
                        className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-200 hover:border-zinc-400 hover:text-white"
                        onClick={(e) => {
                            e.stopPropagation();
                            detachNode(id);
                        }}
                    >
                        Detach
                    </button>
                </NodeToolbar>
            )}

            {/* Muted Bypass Visual - Only show if node has both inputs and outputs */}
            {!!data.muted && leftHandles.length > 0 && rightHandles.length > 0 && (
                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-xl">
                    <svg className="w-full h-full">
                        <line
                            x1="0"
                            y1={getHandleY(leftHandles, ['in_a', 'a'])}
                            x2="100%"
                            y2={getHandleY(rightHandles, ['out_a', 'out', 'val'])}
                            stroke="var(--color-scalar)"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                            className="animate-visual-tick-flow opacity-60"
                        />
                    </svg>
                </div>
            )}

            {/* Central Muted Overlay */}
            {!!data.muted && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none animate-in fade-in zoom-in-95 duration-200">
                    <span className="text-[14px] font-black tracking-[0.3em] uppercase text-red-500/80 drop-shadow-[0_0_8px_rgba(239, 68, 68, 0.4)]">
                        MUTED
                    </span>
                </div>
            )}

            {/* Header */}
            <div
                className="px-3 py-2 border-b border-zinc-800/60 flex items-center justify-between shrink-0 rounded-t-xl"
                style={{ background: 'var(--node-bg-header)' }}
                onDoubleClick={handleRename}
            >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    {isRenaming ? (
                        <StringInput
                            ref={inputRef}
                            value={title}
                            autoSelect={true}
                            onChange={(val) => {
                                setTitle(val);
                                const trimmed = val.trim();
                                const invalid = trimmed === '' || labelSetRef.current.has(trimmed.toLowerCase());
                                setIsError(invalid);
                            }}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            variant="ghost"
                            monospace={false}
                            inputClassName={cn(
                                "text-xs font-bold w-full border-b transition-colors duration-200 rounded-none px-0 py-0",
                                isError ? "text-red-400 border-red-500/50" : "text-zinc-200 border-transparent focus:border-zinc-500/50"
                            )}
                        />
                    ) : (
                        <span className="text-xs font-bold text-zinc-300 select-none truncate">{title}</span>
                    )}
                </div>

                {/* Visual Hint for Editable */}
                {!isRenaming && (
                    <Pencil className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                )}
            </div>

            {/* Content Body — overflow-hidden here clips Sticky Note text without affecting Handles */}
            <div className="p-2 flex-1 flex flex-col items-stretch justify-start min-h-0 min-w-0 overflow-hidden rounded-b-xl">
               {children ? children : (
                    <div className="text-[10px] text-zinc-500 font-mono">ID: {id}</div>
                )}
            </div>

            {/* ─── Left Handles (Targets/Inputs) ───────────────── */}
            {!hideDefaultHandles && (
                <div className="absolute left-0 w-0 bottom-0 flex flex-col items-center justify-start pt-3" style={{ top: `${NODE_LAYOUT.headerH}px`, gap: `${NODE_LAYOUT.socketGap}px` }}>
                    {leftHandles.map((h) => (
                        <DynamicNodeHandle key={h.id} h={h} id={id} isConnectable={isConnectable} data={data} />
                    ))}
                </div>
            )}

            {/* ─── Right Handles (Sources/Outputs) ─────────────── */}
            {!hideDefaultHandles && (
                <div className="absolute right-0 w-0 bottom-0 flex flex-col items-center justify-start pt-3" style={{ top: `${NODE_LAYOUT.headerH}px`, gap: `${NODE_LAYOUT.socketGap}px` }}>
                    {rightHandles.map((h) => (
                        <DynamicNodeHandle key={h.id} h={h} id={id} isConnectable={isConnectable} data={data} />
                    ))}
                </div>
            )}
        </div>
    );
}));

BaseNode.displayName = 'BaseNode';

