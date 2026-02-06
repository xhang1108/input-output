'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { NodeProps, NodeResizer, Position, useReactFlow, useUpdateNodeInternals } from '@xyflow/react';
import { Pencil } from 'lucide-react';
import { NodeHandle } from './NodeHandle';

// Handle Configuration Types
export interface HandleConfig {
    id: string;
    type: 'source' | 'target';
    position: Position;
    variant: 'single' | 'capsule'; // Determines size/styling
    label?: string;
}

// Default Configuration (Fallback)
const DEFAULT_HANDLES: HandleConfig[] = [
    { id: 'in-capsule', type: 'target', position: Position.Left, variant: 'capsule', label: 'Multi' },
    { id: 'in-a', type: 'target', position: Position.Left, variant: 'single' },
    { id: 'in-b', type: 'target', position: Position.Left, variant: 'single' },
];

export const BaseNode = memo(({ id, data, selected, isConnectable }: NodeProps) => {
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

    // Auto-Layout Calculation for Left Handles
    // Start below header (approx 52px)
    let currentTop = 52;
    const SPACING = 8; // Unified 8px spacing

    // Calculate positions and total height
    const handles = (data.handles as HandleConfig[]) || DEFAULT_HANDLES;
    const renderedHandles = handles.map((h) => {
        const height = h.variant === 'capsule' ? 24 : 12; // h-6 vs h-3
        const top = currentTop + (height / 2); // Center of handle
        currentTop += height + SPACING;

        return { ...h, top, height };
    });

    // Minimum height to fit all handles + bottom padding
    const minHeight = Math.max(100, currentTop + 12);

    return (
        <div
            className={`
                relative min-w-[150px] bg-zinc-900 rounded-xl border transition-all duration-200 group
                ${selected ? 'border-zinc-400 ring-1 ring-zinc-400 shadow-2xl scale-[1.02]' : 'border-zinc-700 hover:border-zinc-500 shadow-xl'}
            `}
            style={{ minHeight: `${minHeight}px` }}
        >
            {/* Header */}
            <div
                className="px-3 py-2 border-b border-zinc-800 bg-zinc-800/50 rounded-t-xl flex items-center justify-between"
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
                    <Pencil className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </div>

            {/* Content Body Placeholder */}
            <div className="p-3">
                {/* This would be where specific node content goes */}
                <div className="text-[10px] text-zinc-500 font-mono">ID: {id}</div>
            </div>

            {/* Dynamic Input Handles */}
            {renderedHandles.map((h) => (
                <div key={h.id}>
                    <NodeHandle
                        type={h.type}
                        position={h.position}
                        id={h.id}
                        nodeId={id}
                        className={`
                            border-zinc-900! z-50 pointer-events-auto origin-center
                            ${h.variant === 'capsule'
                                ? 'bg-purple-500! w-3! h-6! rounded-full!'
                                : 'bg-blue-500! w-3! h-3!'}
                            ${h.id === 'in-b' ? 'bg-cyan-500!' : ''} 
                        `}
                        // Note: Tailwind arbitrary values in className don't support dynamic ${} well for layout in some internal tools, 
                        // but hit testing relies on the component. 
                        // We use inline style for robust layout engine.
                        style={{ top: `${h.top}px` }}
                        isConnectable={isConnectable}
                    />
                </div>
            ))}

            {/* Output - Right Center */}
            <NodeHandle
                type="source"
                position={Position.Right}
                id="out"
                nodeId={id}
                className="bg-emerald-500! w-3! h-3! border-zinc-900! z-50 origin-center"
                isConnectable={isConnectable}
            />
        </div>
    );
});

BaseNode.displayName = 'BaseNode';
