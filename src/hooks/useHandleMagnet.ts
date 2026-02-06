import { useStore, Position } from '@xyflow/react';

export function useHandleMagnet(targetX: number, targetY: number) {
    const nodeLookup = useStore((s) => s.nodeLookup);
    const connectionHandleId = useStore((s: any) => s.connectionHandleId);
    const connectionNodeId = useStore((s: any) => s.connectionNodeId);

    // Default: No snap
    let effectiveX = targetX;
    let effectiveY = targetY;
    let effectivePos: Position | undefined = undefined; // Undefined means let consumer decide default
    let isSnapped = false;

    // A: Check React Flow Store (Native Snapping)
    let snappedHandleId = connectionHandleId;
    let snappedNodeId = connectionNodeId;

    // B: Manual Collision Detection (Universal)
    // Find the CLOSEST handle within the snap radius if native didn't catch it
    if (!snappedHandleId) {
        let minDistance = Infinity;
        let closestHandleId = null;
        let closestNodeId = null;
        const SNAP_RADIUS = 20; // Flow units

        for (const [id, node] of nodeLookup) {
            if (node.hidden) continue;
            const handleBounds = node.internals?.handleBounds;
            if (!handleBounds) continue;

            const allHandles = [...(handleBounds.source || []), ...(handleBounds.target || [])];

            for (const h of allHandles) {
                // Handle Center in World Space
                const hCenterX = node.internals.positionAbsolute.x + h.x + h.width / 2;
                const hCenterY = node.internals.positionAbsolute.y + h.y + h.height / 2;

                // Euclidean Distance
                const dist = Math.sqrt(Math.pow(targetX - hCenterX, 2) + Math.pow(targetY - hCenterY, 2));

                if (dist <= SNAP_RADIUS && dist < minDistance) {
                    minDistance = dist;
                    closestHandleId = h.id;
                    closestNodeId = id;
                }
            }
        }

        if (closestHandleId && closestNodeId) {
            snappedHandleId = closestHandleId;
            snappedNodeId = closestNodeId;
        }
    }

    // Resolve Coordinates
    if (snappedHandleId && snappedNodeId) {
        const hoveredNode = nodeLookup.get(snappedNodeId);
        if (hoveredNode) {
            const handleBounds = hoveredNode.internals?.handleBounds;
            if (handleBounds) {
                const allHandles = [...(handleBounds.source || []), ...(handleBounds.target || [])];
                const handle = allHandles.find(h => h.id === snappedHandleId);
                if (handle) {
                    effectiveX = hoveredNode.internals.positionAbsolute.x + handle.x + (handle.width / 2);
                    effectiveY = hoveredNode.internals.positionAbsolute.y + handle.y + (handle.height / 2);
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
