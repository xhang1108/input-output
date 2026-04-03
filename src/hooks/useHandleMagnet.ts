import { useStore, Position } from '@xyflow/react';
import { getNearestHandle } from '../utils/geometry';
import { getHandleVariant } from '../utils/handleUtils';

// Global state to expose the currently magnetically snapped handle for event handlers
export const MagneticSnapState = {
    nodeId: null as string | null,
    handleId: null as string | null,
};

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
    let handleCenterY = targetY; // The actual handle center Y (for capsule slot calculation)

    // Manual Collision Detection (using unified geometry helper)
    if (!snappedHandleId) {
        const result = getNearestHandle(targetX, targetY, nodeLookup, 20);
        if (result) {
            effectiveX = result.x;
            effectiveY = result.y;
            handleCenterY = result.y;
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
                    handleCenterY = effectiveY;
                    effectivePos = handle.position;
                    isSnapped = true;
                }
            }
        }
    }

    // For capsule handles: snap X only, let Y be free (user picks slot by moving mouse up/down)
    if (isSnapped && snappedNodeId && snappedHandleId) {
        const snappedNode = nodeLookup.get(snappedNodeId);
        const variant = getHandleVariant(snappedNode, snappedHandleId);

        // Find the group type from result (if we just snapped) or lookup
        const results = getNearestHandle(targetX, targetY, nodeLookup, 20);
        const handleType = results?.type;

        if (variant === 'capsule' && handleType === 'target') {
            // Keep X snapped to handle, but let Y follow the mouse
            effectiveY = targetY;
        }
    }

    // Update global state for onConnectEnd fallback (safe to do during render for this read-only use case)
    MagneticSnapState.nodeId = snappedNodeId;
    MagneticSnapState.handleId = snappedHandleId;

    return {
        x: effectiveX,
        y: effectiveY,
        handleCenterY, // Always the actual handle center Y
        position: effectivePos,
        isSnapped,
        snappedNodeId,
        snappedHandleId
    };
}

