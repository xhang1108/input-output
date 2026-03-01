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
export function NodeHandle({ className, color, id, nodeId, ...props }: CustomHandleProps) {
    const isPending = id.endsWith('_pending');

    return (
        <Handle
            id={id}
            className={cn(
                "z-50 pointer-events-auto origin-center w-(--handle-size-sm)! h-(--handle-size-sm) rounded-full border-2 border-zinc-900",
                isPending && "border-dashed opacity-100 border-zinc-300! bg-transparent!",
                className
            )}
            style={{
                background: isPending ? 'transparent' : (color || 'var(--color-scalar)'),
                ...props.style
            }}
            {...props}
        />
    );
}
