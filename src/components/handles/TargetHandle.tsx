'use client';

import { Handle, type HandleProps, Position } from '@xyflow/react';

interface TargetHandleProps extends Omit<HandleProps, 'type'> {
    nodeId: string;
    // Target handles are always green in our current design, but we keep the prop for consistency if needed or ignore it.
}

/**
 * TargetHandle Component
 * 
 * Represents an Input handle (Left side).
 * Features:
 * - Unified "Green Dot + White Border" styling.
 */
export function TargetHandle({ nodeId, id, className, style, position = Position.Left, ...props }: TargetHandleProps) {
    // Filter out conflicting color/size classes to enforce standard styles
    const cleanClassName = (className || '')
        .replace(/!bg-[^\s]+/g, '')
        .replace(/!border-[^\s]+/g, '')
        .replace(/!w-[^\s]+/g, '')
        .replace(/!h-[^\s]+/g, '');

    return (
        <Handle
            {...props}
            id={id}
            type="target"
            position={position}
            // Direct Style: Green Solid, White Border, Standard Size (w-3 h-3)
            className={`
                nodrag 
                !w-3 !h-3 
                !rounded-full 
                !border-2 !border-white 
                !bg-green-500 
                ${cleanClassName}
            `.trim().replace(/\s+/g, ' ')}
            style={{
                pointerEvents: 'all',
                zIndex: 10,
                ...style,
            }}
        />
    );
}
