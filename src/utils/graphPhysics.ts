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
 * Returns the average of visual centers of the provided nodes.
 */
export function getMedianCenter(nodes: Node[]): { x: number; y: number } {
    if (nodes.length === 0) return { x: 0, y: 0 };

    let sumX = 0;
    let sumY = 0;

    nodes.forEach(n => {
        const w = n.measured?.width ?? n.width ?? 200;
        const h = n.measured?.height ?? n.height ?? 50;
        sumX += n.position.x + w / 2;
        sumY += n.position.y + h / 2;
    });

    return {
        x: sumX / nodes.length,
        y: sumY / nodes.length
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

/**
 * Scales nodes positions relative to a center point, using node visual centers for stability.
 */
export function scaleNodes(
    nodes: Node[],
    pivot: { x: number; y: number },
    scale: number,
    initialPositions: Record<string, { x: number; y: number }>
): Node[] {
    return nodes.map(node => {
        const initialPos = initialPositions[node.id];
        if (!initialPos) return node;

        const w = node.measured?.width ?? node.width ?? 200;
        const h = node.measured?.height ?? node.height ?? 50;

        // Current visual center relative to pivot
        const initialCenterX = initialPos.x + w / 2;
        const initialCenterY = initialPos.y + h / 2;

        const dx = initialCenterX - pivot.x;
        const dy = initialCenterY - pivot.y;

        // Transformed visual center
        const newCenterX = pivot.x + dx * scale;
        const newCenterY = pivot.y + dy * scale;

        return {
            ...node,
            position: {
                x: newCenterX - w / 2,
                y: newCenterY - h / 2
            }
        };
    });
}

/**
 * Rotates nodes positions relative to a center point, using node visual centers for stability.
 */
export function rotateNodes(
    nodes: Node[],
    pivot: { x: number; y: number },
    angleRad: number,
    initialPositions: Record<string, { x: number; y: number }>
): Node[] {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    return nodes.map(node => {
        const initialPos = initialPositions[node.id];
        if (!initialPos) return node;

        const w = node.measured?.width ?? node.width ?? 200;
        const h = node.measured?.height ?? node.height ?? 50;

        // Visual center relative to pivot
        const initialCenterX = initialPos.x + w / 2;
        const initialCenterY = initialPos.y + h / 2;

        const dx = initialCenterX - pivot.x;
        const dy = initialCenterY - pivot.y;

        // Transformed visual center
        const newCenterX = pivot.x + (dx * cos - dy * sin);
        const newCenterY = pivot.y + (dx * sin + dy * cos);

        return {
            ...node,
            position: {
                x: newCenterX - w / 2,
                y: newCenterY - h / 2
            }
        };
    });
}
