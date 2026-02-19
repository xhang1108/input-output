import { useStore, Position } from '@xyflow/react';
import { getNearestHandle } from '../utils/geometry';

export function useHandleMagnet(targetX: number, targetY: number) {
    const nodeLookup = useStore((s) => s.nodeLookup);
    const connectionHandleId = useStore((s) => (s as { connectionHandleId?: string | null }).connectionHandleId);
    const connectionNodeId = useStore((s) => (s as { connectionNodeId?: string | null }).connectionNodeId);

    // Default: No snap
    let effectiveX = targetX;
    let effectiveY = targetY;
    let effectivePos: Position | undefined = undefined;
    let isSnapped = false;
    let snappedHandleId: string | null = connectionHandleId || null;
    let snappedNodeId: string | null = connectionNodeId || null;

    // Manual Collision Detection (using unified geometry helper)
    if (!snappedHandleId) {
        const result = getNearestHandle(targetX, targetY, nodeLookup, 20);
        if (result) {
            effectiveX = result.x;
            effectiveY = result.y;
            effectivePos = result.position;
            snappedHandleId = result.handleId;
            snappedNodeId = result.nodeId;
            isSnapped = true;
        }
    } else if (snappedNodeId) {
        // Resolve Coordinates for native snapping
        const hoveredNode = nodeLookup.get(snappedNodeId);
        if (hoveredNode) {
            const internals = (hoveredNode as Record<string, unknown>).internals as {
                handleBounds?: { source?: { id: string, x: number, y: number, width: number, height: number, position: Position }[], target?: { id: string, x: number, y: number, width: number, height: number, position: Position }[] };
                positionAbsolute: { x: number, y: number };
            };
            const handleBounds = internals?.handleBounds;
            if (handleBounds) {
                const allHandles = [...(handleBounds.source || []), ...(handleBounds.target || [])];
                const handle = allHandles.find(h => h.id === snappedHandleId);
                if (handle) {
                    effectiveX = internals.positionAbsolute.x + handle.x + (handle.width / 2);
                    effectiveY = internals.positionAbsolute.y + handle.y + (handle.height / 2);
                    effectivePos = handle.position;
                    isSnapped = true;
                }
            }
        }
    }

    return {
        x: effectiveX,
        y: effectiveY,
        position: effectivePos,
        isSnapped,
        snappedNodeId,
        snappedHandleId
    };
}
