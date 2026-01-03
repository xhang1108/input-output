import { type Node, type Edge, type XYPosition } from '@xyflow/react';
import { nanoid } from 'nanoid';

// Level 1: External Pure Atoms

/**
 * Creates a standard Node object with generated ID and default flags.
 */
export function createNodeObject(
    type: string,
    position: XYPosition,
    data: Record<string, unknown>,
    selected: boolean = false
): Node {
    return {
        id: nanoid(8),
        type,
        position,
        data: { ...data },
        selected,
        draggable: true,
        connectable: true,
        focusable: true,
    };
}

/**
 * Returns the geometric center {x, y} of the provided nodes.
 */
export function getBoundingBox(nodes: Node[]): { x: number; y: number } {
    if (nodes.length === 0) return { x: 0, y: 0 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(n => {
        const x = n.position.x;
        const y = n.position.y;
        const w = n.measured?.width ?? n.width ?? 200;
        const h = n.measured?.height ?? n.height ?? 50;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
    });

    return {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2
    };
}

/**
 * Calculates the offset and returns a new array of Node objects.
 */
export function generateOffsetNodes(
    sourceNodes: Node[],
    targetCenter: { x: number; y: number },
    currentCenter: { x: number; y: number }
): Node[] {
    const moveX = targetCenter.x - currentCenter.x;
    const moveY = targetCenter.y - currentCenter.y;

    return sourceNodes.map(node => {
        const newPos = {
            x: node.position.x + moveX,
            y: node.position.y + moveY
        };
        // Reuse createNodeObject to ensure consistency
        return createNodeObject(node.type || 'default', newPos, node.data, true);
    });
}

/**
 * Returns an array of Edge IDs that are connected to the specified nodes.
 */
export function getConnectedEdgeIds(allEdges: Edge[], nodeIdsToRemove: Set<string>): string[] {
    return allEdges
        .filter(e => nodeIdsToRemove.has(e.source) || nodeIdsToRemove.has(e.target))
        .map(e => e.id);
}
