'use client';

import { Handle, HandleProps } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface CustomHandleProps extends HandleProps {
    color?: string; // CSS variable or hex
    id: string;
    nodeId: string;
}

/**
 * NodeHandle - Performance-optimized custom handle.
 *
 * 🔑 Key Design Decision (Performance §0.9):
 * Previously, each handle subscribed to `useStore` to track connectionHandleId/nodeId,
 * causing 200+ re-renders per frame during connection drag (50 nodes × 4 handles).
 *
 * Now: ALL hover/glow effects use pure CSS (`:hover`, `.react-flow__handle-valid`).
 * React Flow already applies these classes natively. Zero JS overhead.
 */
export function NodeHandle({ className, color, style, id, nodeId, ...props }: CustomHandleProps) {
    return (
        <Handle
            id={id}
            className={cn(
                "w-3 h-3 rounded-full border-2 border-zinc-900 transition-all duration-150 z-50",
                className
            )}
            style={{
                background: color || 'var(--color-scalar)',
                ...style
            }}
            {...props}
        />
    );
}
