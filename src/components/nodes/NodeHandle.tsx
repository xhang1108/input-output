'use client';

import { Handle, HandleProps, useStore } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useContext, useState } from 'react';
import { RelinkContext, RelinkState } from '../edges/RelinkLine';

interface CustomHandleProps extends HandleProps {
    color?: string; // CSS variable or hex
    id: string; // Ensure ID is required for comparison
    nodeId: string; // Parent node ID
}

export function NodeHandle({ className, color, style, id, nodeId, ...props }: CustomHandleProps) {
    const relink = useContext(RelinkContext) as RelinkState;

    // Check if THIS handle is being hovered during an active connection
    const connectionState = useStore((s: any) => ({
        handleId: s.connectionHandleId,
        nodeId: s.connectionNodeId,
        inProgress: s.connectionStartHandle !== null
    }));

    const [localHover, setLocalHover] = useState(false);
    const isHovered = (connectionState.handleId === id && connectionState.nodeId === nodeId) || localHover;

    // Note: isHovered might still be false for start handles in some versions.
    // If it's still not glowing, we'd need to sync the 'snapped' state from the connection line.
    // For now, let's assume allowSelfConnect={false} but isHovered might still work for styles.

    return (
        <Handle
            id={id}
            className={cn(
                "w-3 h-3 rounded-full border-2 border-zinc-900 transition-all z-50 hover:scale-110",
                className
            )}
            onMouseEnter={() => setLocalHover(true)}
            onMouseLeave={() => setLocalHover(false)}
            style={{
                background: color || 'var(--color-scalar)',
                ...style
            }}
            {...props}
        />
    );
}
