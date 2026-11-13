import { memo, useEffect } from 'react';
import { Position, useNodeConnections, useUpdateNodeInternals } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NodeHandle } from './NodeHandle';
import { HandleConfig } from '../../types/nodeDefinitions';
import { getHandleColorByConfig as getHandleColor, resolveHandlePosition, assertUniqueHandleIds } from '../../utils/handleUtils';
import { useCapsulePreview } from '../edges/capsulePreviewState';
import { calculateCapsuleHeight } from '../../utils/handleUtils';

interface CapsuleHandleProps {
    h: HandleConfig;
    id: string;
    isConnectable: boolean;
    nodeData?: any;
}

export const CapsuleHandle = memo(({ h, id, isConnectable, nodeData }: CapsuleHandleProps) => {
    const connections = useNodeConnections({ handleType: h.type, handleId: h.id });
    const preview = useCapsulePreview();
    const updateNodeInternals = useUpdateNodeInternals();

    const isPreviewing = preview.active && preview.nodeId === id && preview.handleId === h.id;
    // If the new wire is already in React Flow's state, don't double count the preview wire
    const isAlreadyCommitted = isPreviewing && connections.length >= preview.totalSlots;
    const count = connections.length + (isPreviewing && !isAlreadyCommitted ? 1 : 0);
    const dynamicHeight = calculateCapsuleHeight(count);

    // P2-11 (dev-only): fail fast on empty handle ids. Cross-handle duplicate
    // detection lives in BaseNode, the only place with the full sibling list.
    if (process.env.NODE_ENV !== 'production') {
        assertUniqueHandleIds([{ id: h.id }], id);
    }

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
            <NodeHandle
                type={h.type}
                position={resolveHandlePosition(h)}
                id={h.id}
                nodeId={id}
                className="z-50 pointer-events-auto origin-center w-(--handle-size-sm)! rounded-full!"
                style={{ height: `${dynamicHeight}px` }}
                color={getHandleColor({
                    ...h,
                    dataType: h.dynamicColor ? h.dynamicColor(nodeData) : h.dataType
                })}
                isConnectable={isConnectable}
                maxConnections={50}
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

CapsuleHandle.displayName = 'CapsuleHandle';

