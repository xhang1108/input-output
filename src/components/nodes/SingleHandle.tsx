import { memo } from 'react';
import { Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NodeHandle } from './NodeHandle';
import { HandleConfig, getHandleColor, resolveHandlePosition } from '../../types/NodeDefinition';

interface SingleHandleProps {
    h: HandleConfig;
    id: string;
    isConnectable: boolean;
}

export const SingleHandle = memo(({ h, id, isConnectable }: SingleHandleProps) => {
    const isManual = h.y !== undefined;
    const dynamicHeight = 12;

    return (
        <div
            className={cn(
                "relative flex items-center justify-center",
                isManual && "absolute translate-y--1/2"
            )}
            style={isManual ? { top: typeof h.y === 'number' ? `${h.y}px` : h.y } : undefined}
        >
            <NodeHandle
                type={h.type}
                position={resolveHandlePosition(h)}
                id={h.id}
                nodeId={id}
                className="border-zinc-900! z-50 pointer-events-auto origin-center w-(--handle-size-sm)! h-(--handle-size-sm)!"
                color={getHandleColor(h)}
                isConnectable={isConnectable}
            />

            {/* Placeholder for the handle's space in the flex column (only if NOT manual) */}
            {!isManual && (
                <div
                    style={{
                        width: '1px',
                        height: `${dynamicHeight}px`
                    }}
                />
            )}
        </div>
    );
});

SingleHandle.displayName = 'SingleHandle';
