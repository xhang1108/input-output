import { Node, Position } from '@xyflow/react';

export interface SnapResult {
    x: number;
    y: number;
    position: Position;
    distance: number;
    nodeId: string;
    handleId: string;
    type: 'source' | 'target';
}

interface InternalHandle {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    position: Position;
}

/**
 * Calculates the Euclidean distance between two points.
 */
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Finds the nearest handle to a given coordinate within a specified radius.
 * This is a pure function that doesn't depend on React state.
 */
export function getNearestHandle(
    targetX: number,
    targetY: number,
    nodeLookup: Map<string, Node>,
    snapRadius: number = 20
): SnapResult | null {
    let minDistance = Infinity;
    let result: SnapResult | null = null;

    for (const [id, node] of nodeLookup) {
        if (node.hidden) continue;

        // Note: react-flow nodes have 'internals' which contain absolute positions and handle bounds
        const internals = (node as Node & { internals?: Record<string, unknown> }).internals;
        const handleBounds = (internals as Record<string, unknown>)?.handleBounds as { source?: InternalHandle[], target?: InternalHandle[] } | undefined;
        if (!handleBounds) continue;

        const handleGroups = [
            { type: 'source' as const, handles: handleBounds.source || [] },
            { type: 'target' as const, handles: handleBounds.target || [] }
        ];

        for (const group of handleGroups) {
            for (const h of group.handles) {
                // Handle Center in World Space
                if (internals && internals.positionAbsolute) {
                    const pos = internals.positionAbsolute as { x: number, y: number };
                    const hCenterX = pos.x + h.x + h.width / 2;
                    const hCenterY = pos.y + h.y + h.height / 2;

                    const dist = getDistance(targetX, targetY, hCenterX, hCenterY);

                    if (dist <= snapRadius && dist < minDistance) {
                        minDistance = dist;
                        result = {
                            x: hCenterX,
                            y: hCenterY,
                            position: h.position,
                            distance: dist,
                            nodeId: id,
                            handleId: h.id!,
                            type: group.type
                        };
                    }
                }
            }
        }
    }

    return result;
}

