'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { NodeProps, NodeResizer, Position, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { Pencil } from 'lucide-react';
import { NodeHandle } from './NodeHandle';
import { HandleConfig, getHandleColor } from '../../types/NodeDefinition';

// Re-export HandleConfig for backward compatibility
export type { HandleConfig } from '../../types/NodeDefinition';

// Default fallback handles (used when data.handles is not provided)
const DEFAULT_HANDLES: HandleConfig[] = [
    { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'scalar' },
    { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' },
];

export const BaseNode = memo(({ id, data, selected, isConnectable, children }: NodeProps & { children?: React.ReactNode }) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [title, setTitle] = useState((data.label as string) || 'Node');
    const inputRef = useRef<HTMLInputElement>(null);
    const { updateNodeData } = useReactFlow();
    const updateNodeInternals = useUpdateNodeInternals();

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

    // ─── Handle Layout Engine ─────────────────────────────────
    // Separate handles by position (left vs right)
    const allHandles = (data.handles as HandleConfig[]) || DEFAULT_HANDLES;
    const leftHandles = allHandles.filter(h => h.position === Position.Left);
    const rightHandles = allHandles.filter(h => h.position === Position.Right);

    // Auto-Layout: Calculate vertical positions for left-side handles
    const HEADER_HEIGHT = 52;
    const SPACING = 8;

    const layoutHandles = (handles: HandleConfig[]) => {
        let currentTop = HEADER_HEIGHT;
        return handles.map((h) => {
            const height = h.variant === 'capsule' ? 24 : 12;
            const top = currentTop + (height / 2);
            currentTop += height + SPACING;
            return { ...h, top, height };
        });
    };

    const renderedLeftHandles = layoutHandles(leftHandles);
    const renderedRightHandles = layoutHandles(rightHandles);

    // If only one right handle, center it vertically
    const leftContentHeight = renderedLeftHandles.length > 0
        ? renderedLeftHandles[renderedLeftHandles.length - 1].top + 12
        : HEADER_HEIGHT + 40;

    // Minimum height to fit all handles + bottom padding
    const minHeight = Math.max(100, leftContentHeight + 12);

    return (
        <div
            className={`
                relative min-w-[150px] rounded-xl border transition-all duration-200 group
                ${selected
                    ? 'border-zinc-400 node-shadow-3 animate-ring-pulse scale-[1.02]'
                    : 'border-zinc-700 hover:border-zinc-500 node-shadow-1 hover:node-shadow-2'}
            `}
            style={{ minHeight: `${minHeight}px`, background: 'var(--node-bg)' }}
        >
            {/* Header */}
            <div
                className="px-3 py-2 border-b border-zinc-800/60 rounded-t-xl flex items-center justify-between"
                style={{ background: 'var(--node-bg-header)' }}
                onDoubleClick={handleRename}
            >
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
                    <span className="text-xs font-bold text-zinc-300 select-none">{title}</span>
                )}

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
            {renderedLeftHandles.map((h) => (
                <div key={h.id} className="contents">
                    <NodeHandle
                        type={h.type}
                        position={h.position}
                        id={h.id}
                        nodeId={id}
                        className={`
                            border-zinc-900! z-50 pointer-events-auto origin-center
                            ${h.variant === 'capsule'
                                ? 'w-3! h-6! rounded-full!'
                                : 'w-3! h-3!'}
                        `}
                        color={getHandleColor(h)}
                        style={{ top: `${h.top}px` }}
                        isConnectable={isConnectable}
                    />
                </div>
            ))}

            {/* ─── Right Handles (Sources/Outputs) ─────────────── */}
            {renderedRightHandles.length === 1 ? (
                // Single output: center vertically
                <div className="contents">
                    <NodeHandle
                        type={renderedRightHandles[0].type}
                        position={renderedRightHandles[0].position}
                        id={renderedRightHandles[0].id}
                        nodeId={id}
                        className={`
                            border-zinc-900! z-50 origin-center
                            ${renderedRightHandles[0].variant === 'capsule'
                                ? 'w-3! h-6! rounded-full!'
                                : 'w-3! h-3!'}
                        `}
                        color={getHandleColor(renderedRightHandles[0])}
                        isConnectable={isConnectable}
                    />
                </div>
            ) : (
                // Multiple outputs: layout vertically
                renderedRightHandles.map((h) => (
                    <div key={h.id} className="contents">
                        <NodeHandle
                            type={h.type}
                            position={h.position}
                            id={h.id}
                            nodeId={id}
                            className={`
                                border-zinc-900! z-50 pointer-events-auto origin-center
                                ${h.variant === 'capsule'
                                    ? 'w-3! h-6! rounded-full!'
                                    : 'w-3! h-3!'}
                            `}
                            color={getHandleColor(h)}
                            style={{ top: `${h.top}px` }}
                            isConnectable={isConnectable}
                        />
                    </div>
                ))
            )}
        </div>
    );
});

BaseNode.displayName = 'BaseNode';
