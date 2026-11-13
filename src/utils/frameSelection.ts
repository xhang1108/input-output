import type { Node } from '@xyflow/react';

export interface SelectionRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FrameRect extends SelectionRect {}

export function getFrameRect(node: Node): FrameRect {
    return {
        x: node.position.x,
        y: node.position.y,
        width: node.width ?? node.measured?.width ?? (node.data?.width as number) ?? 0,
        height: node.height ?? node.measured?.height ?? (node.data?.height as number) ?? 0,
    };
}

/** True when a flow-space point is inside the frame rectangle. */
export function pointInFrame(point: { x: number; y: number }, frame: FrameRect): boolean {
    return (
        point.x >= frame.x &&
        point.x <= frame.x + frame.width &&
        point.y >= frame.y &&
        point.y <= frame.y + frame.height
    );
}

function overlaps(a: SelectionRect, b: SelectionRect): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

/**
 * A marquee should select a frame only when it touches the frame border,
 * not when it is entirely inside the frame (selecting children).
 */
export function selectionTouchesFrameBorder(
    selection: SelectionRect,
    frame: FrameRect,
    band = 10
): boolean {
    if (!overlaps(selection, frame)) return false;

    const innerWidth = frame.width - band * 2;
    const innerHeight = frame.height - band * 2;
    if (innerWidth <= 0 || innerHeight <= 0) return true;

    const inner = {
        x: frame.x + band,
        y: frame.y + band,
        width: innerWidth,
        height: innerHeight,
    };

    const fullyInsideInner =
        selection.x >= inner.x &&
        selection.y >= inner.y &&
        selection.x + selection.width <= inner.x + inner.width &&
        selection.y + selection.height <= inner.y + inner.height;

    return !fullyInsideInner;
}
