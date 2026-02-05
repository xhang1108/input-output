'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { NodeProps, NodeResizer, Position } from '@xyflow/react';
import { Pencil } from 'lucide-react';
import { NodeHandle } from './NodeHandle';

export const BaseNode = memo(({ data, selected, isConnectable }: NodeProps) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [title, setTitle] = useState((data.label as string) || 'Node');
    const inputRef = useRef<HTMLInputElement>(null);

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
        // Here we would sync back to the global store/data
        // data.label = title; 
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit();
    };

    return (
        <div
            className={`
                relative min-w-[150px] bg-zinc-900 rounded-xl border transition-all duration-200 group
                ${selected ? 'border-zinc-400 ring-1 ring-zinc-400 shadow-2xl scale-[1.02]' : 'border-zinc-700 hover:border-zinc-500 shadow-xl'}
            `}
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
                <div className="text-[10px] text-zinc-500 font-mono">ID: {data.id || 'N/A'}</div>
            </div>

            {/* Handles - Polished */}
            <NodeHandle
                type="target"
                position={Position.Left}
                id="in"
                className="!bg-blue-500 !w-3 !h-3 !border-zinc-900 z-50 origin-center"
                isConnectable={isConnectable}
            />
            <NodeHandle
                type="source"
                position={Position.Right}
                id="out"
                className="!bg-emerald-500 !w-3 !h-3 !border-zinc-900 z-50 origin-center"
                isConnectable={isConnectable}
            />
        </div>
    );
});

BaseNode.displayName = 'BaseNode';
