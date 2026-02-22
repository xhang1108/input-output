import { memo } from 'react';
import { Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NodeHandle } from './NodeHandle';
import { HandleConfig, getHandleColor } from '../../types/NodeDefinition';

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
            {/* Label for Right handles (on the left of the dot) */}
            {h.position === Position.Right && h.label && (
                <span className="absolute right-3.5 text-[9px] text-zinc-500 font-black uppercase pointer-events-none whitespace-nowrap tracking-tighter opacity-80 group-hover:opacity-100 transition-opacity">
                    {h.label}
                </span>
            )}

            <NodeHandle
                type={h.type}
                position={h.position}
                id={h.id}
                nodeId={id}
                className="border-zinc-900! z-50 pointer-events-auto origin-center w-(--handle-size-sm)! h-(--handle-size-sm)!"
                color={getHandleColor(h)}
                isConnectable={isConnectable}
            />

            {/* Label for Left handles (on the right of the dot) */}
            {h.position === Position.Left && h.label && (
                <span className="absolute left-3.5 text-[9px] text-zinc-500 font-black uppercase pointer-events-none whitespace-nowrap tracking-tighter opacity-80 group-hover:opacity-100 transition-opacity">
                    {h.label}
                </span>
            )}

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
