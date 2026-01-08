'use client';

import { forwardRef } from 'react';
import { Handle, type HandleProps, Position } from '@xyflow/react';

interface TargetHandleProps extends Omit<HandleProps, 'type'> {
    nodeId: string;
}

export const TargetHandle = forwardRef<HTMLDivElement, TargetHandleProps>(
    ({ nodeId, id, className, style, position = Position.Left, ...props }, ref) => {
        // Filter out conflicting color/size classes to enforce standard styles
        const cleanClassName = (className || '')
            .replace(/!bg-[^\s]+/g, '')
            .replace(/!border-[^\s]+/g, '')
            .replace(/!w-[^\s]+/g, '')
            .replace(/!h-[^\s]+/g, '');

        return (
            <Handle
                {...props}
                ref={ref}
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
);

TargetHandle.displayName = 'TargetHandle';
