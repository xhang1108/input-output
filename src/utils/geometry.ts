import { Node, Position } from '@xyflow/react';

export interface SnapResult {
    x: number;
    y: number;
    position: Position;
    distance: number;
    nodeId: string;
    handleId: string;
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
        const internals = (node as any).internals;
        const handleBounds = internals?.handleBounds;
        if (!handleBounds) continue;

        const allHandles = [...(handleBounds.source || []), ...(handleBounds.target || [])];

        for (const h of allHandles) {
            // Handle Center in World Space
            const hCenterX = internals.positionAbsolute.x + h.x + h.width / 2;
            const hCenterY = internals.positionAbsolute.y + h.y + h.height / 2;

            const dist = getDistance(targetX, targetY, hCenterX, hCenterY);

            if (dist <= snapRadius && dist < minDistance) {
                minDistance = dist;
                result = {
                    x: hCenterX,
                    y: hCenterY,
                    position: h.position,
                    distance: dist,
                    nodeId: id,
                    handleId: h.id!
                };
            }
        }
    }

    return result;
}

/**
 * Checks if a line segment (x1,y1)-(x2,y2) intersects with a rectangle (rx,ry,rw,rh).
 * This uses the Liang-Barsky algorithm or a simplified Axis Separating Theorem check.
 */
export function intersectsRect(
    x1: number, y1: number, x2: number, y2: number,
    rx: number, ry: number, rw: number, rh: number
): boolean {
    // 1. Trivial Reject (Bounding Box of Segment vs Rect)
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    if (maxX < rx || minX > rx + rw || maxY < ry || minY > ry + rh) {
        return false;
    }

    // 2. Check if either endpoint is inside (Optimization)
    if ((x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) ||
        (x2 >= rx && x2 <= rx + rw && y2 >= ry && y2 <= ry + rh)) {
        return true;
    }

    // 3. Line Intersection with all 4 sides (Cohen-Sutherland-ish)
    // Actually, for AABB, we can just check intersections with the 4 lines of the rect
    // or use a more optimal approach.
    // Let's stick to a robust standard check: Liang-Barsky is best for clipping, 
    // but here we just need boolean.

    // Check intersection with Left (x=rx), Right (x=rx+rw), Top (y=ry), Bottom (y=ry+rh)

    const checkLine = (x3: number, y3: number, x4: number, y4: number) => {
        const uA = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
        const uB = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
        return uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1;
    };

    // Left
    if (checkLine(rx, ry, rx, ry + rh)) return true;
    // Right
    if (checkLine(rx + rw, ry, rx + rw, ry + rh)) return true;
    // Top
    if (checkLine(rx, ry, rx + rw, ry)) return true;
    // Bottom
    if (checkLine(rx, ry + rh, rx + rw, ry + rh)) return true;

    return false;
}
