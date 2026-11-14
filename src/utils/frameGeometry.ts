import type { Node } from '@xyflow/react';
import { toAbsolute, toParentLocal, indexNodes } from './coordinates';

export const FRAME_PADDING = 32;
export const FRAME_TOP_PADDING = 40;

export function getNodeSize(node: Node): { w: number; h: number } {
    return {
        w: node.width ?? node.measured?.width ?? (node.data?.width as number) ?? 150,
        h: node.height ?? node.measured?.height ?? (node.data?.height as number) ?? 50,
    };
}

export interface FrameExpansionResult {
    nodes: Node[];
    changed: boolean;
}

/**
 * Re-fits a frame around its children (grow **or** shrink), keeping every child
 * at the same world position. The frame's top-left is recomputed from the
 * content bounds, so children may get new parent-local coordinates while their
 * absolute position is unchanged.
 */
export function fitFrameToContents(
    nodes: Node[],
    frameId: string,
    padding = FRAME_PADDING,
    topPadding = FRAME_TOP_PADDING,
    minWidth = 200,
    minHeight = 120
): FrameExpansionResult {
    const frame = nodes.find(n => n.id === frameId && n.type === 'frame');
    if (!frame) return { nodes, changed: false };

    const children = nodes.filter(n => n.parentId === frameId);
    if (children.length === 0) return { nodes, changed: false };

    const nodeById = indexNodes(nodes);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const child of children) {
        const abs = toAbsolute(nodeById, child.id);
        const size = getNodeSize(child);
        minX = Math.min(minX, abs.x);
        minY = Math.min(minY, abs.y);
        maxX = Math.max(maxX, abs.x + size.w);
        maxY = Math.max(maxY, abs.y + size.h);
    }

    const nextAbs = {
        x: Math.round(minX - padding),
        y: Math.round(minY - topPadding),
    };
    const nextW = Math.max(minWidth, Math.round(maxX - minX + padding * 2));
    const nextH = Math.max(minHeight, Math.round(maxY - minY + topPadding + padding));

    const currentAbs = toAbsolute(nodeById, frameId);
    const currentSize = getNodeSize(frame);
    const moved = Math.abs(nextAbs.x - currentAbs.x) > 0.5 || Math.abs(nextAbs.y - currentAbs.y) > 0.5;
    const resized = Math.abs(nextW - currentSize.w) > 0.5 || Math.abs(nextH - currentSize.h) > 0.5;
    if (!moved && !resized) return { nodes, changed: false };

    const nextFrameLocal = toParentLocal(nodeById, frameId, nextAbs);
    const nextNodes = nodes.map(node => {
        if (node.id === frameId) {
            return {
                ...node,
                position: nextFrameLocal,
                width: nextW,
                height: nextH,
                data: { ...node.data, width: nextW, height: nextH },
            };
        }
        if (node.parentId === frameId) {
            const abs = toAbsolute(nodeById, node.id);
            return {
                ...node,
                position: { x: abs.x - nextAbs.x, y: abs.y - nextAbs.y },
            };
        }
        return node;
    });

    return { nodes: nextNodes, changed: true };
}

/**
 * Smallest size a frame may be resized to while keeping every child inside.
 * The frame top-left is fixed, so the bound is content-right/bottom relative
 * to the frame origin.
 */
export function getFrameMinSize(
    nodes: Node[],
    frameId: string,
    minWidth = 200,
    minHeight = 120
): { w: number; h: number } {
    const nodeById = indexNodes(nodes);
    const frameAbs = toAbsolute(nodeById, frameId);
    const children = nodes.filter(n => n.parentId === frameId);
    if (children.length === 0) return { w: minWidth, h: minHeight };

    let maxRight = -Infinity;
    let maxBottom = -Infinity;
    for (const child of children) {
        const abs = toAbsolute(nodeById, child.id);
        const size = getNodeSize(child);
        maxRight = Math.max(maxRight, abs.x + size.w);
        maxBottom = Math.max(maxBottom, abs.y + size.h);
    }

    return {
        w: Math.max(minWidth, Math.ceil(maxRight - frameAbs.x)),
        h: Math.max(minHeight, Math.ceil(maxBottom - frameAbs.y)),
    };
}

/**
 * Grows a frame so it contains all direct children, keeping every child's
 * world position fixed. Only expands (never shrinks), which keeps live dragging
 * stable. Children are shifted to the new parent-local origin.
 */
export function expandFrameToFitChildren(
    nodes: Node[],
    frameId: string,
    padding = FRAME_PADDING,
    topPadding = FRAME_TOP_PADDING
): FrameExpansionResult {
    const frame = nodes.find(n => n.id === frameId && n.type === 'frame');
    if (!frame) return { nodes, changed: false };

    const children = nodes.filter(n => n.parentId === frameId);
    if (children.length === 0) return { nodes, changed: false };

    const nodeById = indexNodes(nodes);
    const frameSize = getNodeSize(frame);
    const frameAbs = toAbsolute(nodeById, frameId);
    const frameX = frameAbs.x;
    const frameY = frameAbs.y;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const child of children) {
        const abs = toAbsolute(nodeById, child.id);
        const size = getNodeSize(child);
        minX = Math.min(minX, abs.x);
        minY = Math.min(minY, abs.y);
        maxX = Math.max(maxX, abs.x + size.w);
        maxY = Math.max(maxY, abs.y + size.h);
    }

    const nextX = minX < frameX ? minX - padding : frameX;
    const nextY = minY < frameY ? minY - topPadding : frameY;
    const nextRight = maxX > frameX + frameSize.w ? maxX + padding : frameX + frameSize.w;
    const nextBottom = maxY > frameY + frameSize.h ? maxY + padding : frameY + frameSize.h;
    const nextW = nextRight - nextX;
    const nextH = nextBottom - nextY;

    const frameMoved = Math.abs(nextX - frameX) > 0.5 || Math.abs(nextY - frameY) > 0.5;
    const frameResized = Math.abs(nextW - frameSize.w) > 0.5 || Math.abs(nextH - frameSize.h) > 0.5;
    if (!frameMoved && !frameResized) return { nodes, changed: false };

    const nextFramePos = { x: nextX, y: nextY };
    const nextFrameLocal = toParentLocal(nodeById, frameId, nextFramePos);
    const nextNodes = nodes.map(node => {
        if (node.id === frameId) {
            return {
                ...node,
                position: nextFrameLocal,
                width: nextW,
                height: nextH,
                data: { ...node.data, width: nextW, height: nextH },
            };
        }
        if (node.parentId === frameId) {
            const abs = toAbsolute(nodeById, node.id);
            return {
                ...node,
                position: {
                    x: abs.x - nextFramePos.x,
                    y: abs.y - nextFramePos.y,
                },
            };
        }
        return node;
    });

    return { nodes: nextNodes, changed: true };
}
