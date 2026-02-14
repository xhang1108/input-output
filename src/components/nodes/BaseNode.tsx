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

    const renderedLeftHandles = leftHandles;
    const renderedRightHandles = rightHandles;

    // If only one right handle, center it vertically
    // If only one right handle, center it vertically
    // Use dynamic height or min-height based on handles count + Header
    // 52 (Header) + (Count * (Height + Gap))?
    // For now, just ensuring minHeight is enough.
    const approximateHeight = HEADER_HEIGHT + Math.max(leftHandles.length, rightHandles.length) * 40;

    // Minimum height to fit all handles + bottom padding
    const minHeight = Math.max(100, approximateHeight + 12);

    return (
        <div
            className={`
                relative min-w-[var(--node-width-min)] rounded-xl border transition-all duration-200 group
                ${selected
                    ? 'border-zinc-400 animate-ring-pulse scale-[1.02]'
                    : 'border-zinc-700 hover:border-zinc-500'}
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
            <div className="absolute left-0 w-0 flex flex-col items-center" style={{ top: '52px', gap: 'var(--gap-node-socket)' }}>
                {renderedLeftHandles.length === 1 ? (
                    // Single input: center vertically relative to node (special case)
                    // But if we want NO hardcoding, we might just let it flow or use a specific class
                    // For now, let's keep the single centered logic but use CSS centering
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 h-0 flex items-center">
                        <NodeHandle
                            type={renderedLeftHandles[0].type}
                            position={renderedLeftHandles[0].position}
                            id={renderedLeftHandles[0].id}
                            nodeId={id}
                            className={`
                                border-zinc-900! z-50 pointer-events-auto origin-center
                                ${renderedLeftHandles[0].variant === 'capsule'
                                    ? 'w-(--handle-size-sm)! h-(--handle-size-lg)! rounded-full!'
                                    : 'w-(--handle-size-sm)! h-(--handle-size-sm)!'}
                            `}
                            color={getHandleColor(renderedLeftHandles[0])}
                            isConnectable={isConnectable}
                        // Removing style={{ top }} – allowing flex/absolute centering to work
                        />
                    </div>
                ) : (
                    leftHandles.map((h) => (
                        <div key={h.id} className="relative flex items-center justify-center">
                            <NodeHandle
                                type={h.type}
                                position={h.position}
                                id={h.id}
                                nodeId={id}
                                className={`
                                    border-zinc-900! z-50 pointer-events-auto origin-center
                                    ${h.variant === 'capsule'
                                        ? 'w-(--handle-size-sm)! h-(--handle-size-lg)! rounded-full!'
                                        : 'w-(--handle-size-sm)! h-(--handle-size-sm)!'}
                                `}
                                color={getHandleColor(h)}
                                isConnectable={isConnectable}
                            />
                            {/* Placeholder for the handle's space in the flex column */}
                            <div
                                style={{
                                    width: '1px',
                                    height: h.variant === 'capsule' ? 'var(--handle-size-lg)' : 'var(--handle-size-sm)'
                                }}
                            />
                        </div>
                    ))
                )}
            </div>

            {/* ─── Right Handles (Sources/Outputs) ─────────────── */}
            <div className="absolute right-0 w-0 flex flex-col items-center" style={{ top: '52px', gap: 'var(--gap-node-socket)' }}>
                {renderedRightHandles.length === 1 ? (
                    <div className="absolute top-1/2 -translate-y-1/2 right-0 h-0 flex items-center">
                        <NodeHandle
                            type={renderedRightHandles[0].type}
                            position={renderedRightHandles[0].position}
                            id={renderedRightHandles[0].id}
                            nodeId={id}
                            className={`
                                border-zinc-900! z-50 origin-center
                                ${renderedRightHandles[0].variant === 'capsule'
                                    ? 'w-(--handle-size-sm)! h-(--handle-size-lg)! rounded-full!'
                                    : 'w-(--handle-size-sm)! h-(--handle-size-sm)!'}
                            `}
                            color={getHandleColor(renderedRightHandles[0])}
                            isConnectable={isConnectable}
                        />
                    </div>
                ) : (
                    rightHandles.map((h) => (
                        <div key={h.id} className="relative flex items-center justify-center">
                            <NodeHandle
                                type={h.type}
                                position={h.position}
                                id={h.id}
                                nodeId={id}
                                className={`
                                    border-zinc-900! z-50 pointer-events-auto origin-center
                                    ${h.variant === 'capsule'
                                        ? 'w-(--handle-size-sm)! h-(--handle-size-lg)! rounded-full!'
                                        : 'w-(--handle-size-sm)! h-(--handle-size-sm)!'}
                                `}
                                color={getHandleColor(h)}
                                isConnectable={isConnectable}
                            />
                            <div
                                style={{
                                    width: '1px',
                                    height: h.variant === 'capsule' ? 'var(--handle-size-lg)' : 'var(--handle-size-sm)'
                                }}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

BaseNode.displayName = 'BaseNode';
