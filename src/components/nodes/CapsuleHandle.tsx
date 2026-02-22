import { memo, useEffect } from 'react';
import { Position, useNodeConnections, useUpdateNodeInternals } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NodeHandle } from './NodeHandle';
import { HandleConfig, getHandleColor } from '../../types/NodeDefinition';
import { useCapsulePreview } from '../edges/capsulePreviewState';
import { calculateCapsuleHeight } from '../../utils/handleUtils';

interface CapsuleHandleProps {
    h: HandleConfig;
    id: string;
    isConnectable: boolean;
}

export const CapsuleHandle = memo(({ h, id, isConnectable }: CapsuleHandleProps) => {
    const connections = useNodeConnections({ handleType: h.type, handleId: h.id });
    const preview = useCapsulePreview();
    const updateNodeInternals = useUpdateNodeInternals();

    const isPreviewing = preview.active && preview.nodeId === id && preview.handleId === h.id;
    // If the new wire is already in React Flow's state, don't double count the preview wire
    const isAlreadyCommitted = isPreviewing && connections.length >= preview.totalSlots;
    const count = connections.length + (isPreviewing && !isAlreadyCommitted ? 1 : 0);
    const dynamicHeight = calculateCapsuleHeight(count);

    // CRITICAL: When the height of the capsule handle changes (due to new connections or preview),
    // we MUST notify React Flow to recalculate handle positions for edges.
    useEffect(() => {
        updateNodeInternals(id);
    }, [id, dynamicHeight, updateNodeInternals]);

    const isManual = h.y !== undefined;

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
                className="border-zinc-900! z-50 pointer-events-auto origin-center w-(--handle-size-sm)! rounded-full!"
                style={{ height: `${dynamicHeight}px` }}
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

CapsuleHandle.displayName = 'CapsuleHandle';
