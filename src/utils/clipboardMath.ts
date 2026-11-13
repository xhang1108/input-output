import { Edge, Node, XYPosition } from '@xyflow/react';
import { Transaction } from '../engine/types/engineTypes';
import { generateEdgeId, generateNodeId } from './idGenerator';

/**
 * Pure geometry / ID / transaction helpers for the clipboard commands.
 *
 * COORDINATE SYSTEM (verified, not assumed):
 * - `FlowCanvas.tsx:61` defines `NODE_ORIGIN = [0, 0]` and passes it to
 *   `<ReactFlow nodeOrigin={NODE_ORIGIN}>` (`FlowCanvas.tsx:731`).
 * - React Flow's `calculateChildXYZ` (node_modules/@xyflow/system/dist/esm/index.mjs)
 *   computes `absolute = parent.internals.positionAbsolute + child.position`
 *   with `positionWithOrigin = position - origin * measuredSize`. With origin
 *   `[0, 0]` there is NO half-size shift.
 * - `src/hooks/useBrainUpdates.ts:149-150` also forces `origin: [0, 0]` for
 *   frames, and `DEFAULT_UI_ORIGIN` is `[0, 0]` (`src/types/nodeDefinitions.ts:57`).
 *
 * Therefore the current truth is: **a node's `position` is its top-left, and a
 * child's `position` is relative to the parent's top-left.** `Brain` now
 * delegates to the same top-left helper (`src/utils/coordinates.ts`), so UI,
 * engine and clipboard share one rule. Clipboard math must use React Flow
 * coordinates, so this module deliberately does not subtract half the parent size.
 */

export const CLIPBOARD_SOURCE = 'io-clipboard/1' as const;

export type ClipboardIntent = 'cut' | 'copy';

export interface ClipboardBuffer {
    intent: ClipboardIntent;
    nodes: Node[];
    edges: Edge[];
    schemaVersion: string;
    source: typeof CLIPBOARD_SOURCE;
}

export interface ClipboardLayoutItem {
    node: Node;
    /** Absolute flow coordinate (React Flow top-left semantics). */
    absolute: XYPosition;
    /** Position to write through ADD_NODE (absolute when detached). */
    position: XYPosition;
    /** Parent id inside the buffer, if the relationship is kept. */
    parentId?: string;
    /** Roots receive the paste offset; children of buffered parents do not. */
    isRoot: boolean;
    /** True when the parent was outside the buffer and got dropped (DEC-6 B). */
    detached: boolean;
}

export interface PastePlan {
    nodes: Node[];
    edges: Edge[];
    forward: Transaction[];
    inverse: Transaction[];
    offset: XYPosition;
    reusedIds: boolean;
}

/** structuredClone with a JSON fallback for values it cannot handle. */
export function deepCloneWithFallback<T>(value: T): T {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
    } catch {
        // Fall through to the JSON round-trip.
    }
    return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Absolute position of a node under React Flow top-left semantics.
 * `nodeMap` may contain live and clipboard nodes together; the supplied node wins.
 */
export function getNodeAbsolutePosition(
    nodeId: string,
    nodeMap: Map<string, Node>,
    seen: Set<string> = new Set()
): XYPosition {
    const node = nodeMap.get(nodeId);
    if (!node) return { x: 0, y: 0 };

    if (!node.parentId || seen.has(nodeId)) {
        return { x: node.position.x, y: node.position.y };
    }

    const nextSeen = new Set(seen);
    nextSeen.add(nodeId);
    const parentAbs = getNodeAbsolutePosition(node.parentId, nodeMap, nextSeen);

    return {
        x: parentAbs.x + node.position.x,
        y: parentAbs.y + node.position.y,
    };
}

/** Size used for the paste bounding box. Measured > explicit > data.width/height. */
export function getNodeDimension(node: Node, axis: 'x' | 'y'): number | undefined {
    const measured = axis === 'x' ? node.measured?.width : node.measured?.height;
    const explicit = axis === 'x' ? node.width : node.height;
    const dataValue = axis === 'x' ? node.data?.width : node.data?.height;

    const candidate = measured ?? explicit ?? (typeof dataValue === 'number' ? dataValue : undefined);
    return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
        ? candidate
        : undefined;
}

/**
 * Normalizes clipboard nodes into one absolute coordinate system.
 *
 * - Node without parent → root, absolute = position.
 * - Parent also in the buffer → keep relative position (the parent moves it).
 * - Parent outside the buffer → DEC-6 B: detach (`parentId = undefined`) and
 *   convert to absolute using the live parent's absolute position. If the parent
 *   no longer exists, fall back to treating the stored position as absolute.
 */
export function computeClipboardLayout(nodes: Node[], liveNodes: Node[] = []): ClipboardLayoutItem[] {
    const bufferById = new Map(nodes.map(node => [node.id, node]));
    // Buffered nodes win: their (relative) positions are the ones being pasted.
    const combinedById = new Map(liveNodes.map(node => [node.id, node]));
    bufferById.forEach((node, id) => combinedById.set(id, node));

    return nodes.map(node => {
        const parentInBuffer = !!node.parentId && bufferById.has(node.parentId);

        if (!node.parentId) {
            return {
                node,
                absolute: { x: node.position.x, y: node.position.y },
                position: { x: node.position.x, y: node.position.y },
                isRoot: true,
                detached: false,
            };
        }

        if (parentInBuffer) {
            return {
                node,
                absolute: getNodeAbsolutePosition(node.id, combinedById),
                position: { x: node.position.x, y: node.position.y },
                parentId: node.parentId,
                isRoot: false,
                detached: false,
            };
        }

        // DEC-6 B: parent is not part of the clipboard payload → independent node.
        const absolute = getNodeAbsolutePosition(node.id, combinedById);
        return {
            node,
            absolute,
            position: { x: absolute.x, y: absolute.y },
            isRoot: true,
            detached: true,
        };
    });
}

/**
 * DEC-1: offset that puts the absolute bbox CENTER on `targetPos`.
 * If a dimension is unknown, that axis falls back to top-left alignment
 * (cannot center what was never measured).
 */
export function computePasteOffset(layout: ClipboardLayoutItem[], targetPos?: XYPosition): XYPosition {
    if (!targetPos || layout.length === 0) return { x: 20, y: 20 };

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const widths = layout.map(item => getNodeDimension(item.node, 'x'));
    const heights = layout.map(item => getNodeDimension(item.node, 'y'));
    const hasWidths = widths.every(width => width !== undefined);
    const hasHeights = heights.every(height => height !== undefined);

    layout.forEach((item, index) => {
        minX = Math.min(minX, item.absolute.x);
        minY = Math.min(minY, item.absolute.y);
        maxX = Math.max(maxX, item.absolute.x + (widths[index] ?? 0));
        maxY = Math.max(maxY, item.absolute.y + (heights[index] ?? 0));
    });

    return {
        x: hasWidths ? targetPos.x - (minX + maxX) / 2 : targetPos.x - minX,
        y: hasHeights ? targetPos.y - (minY + maxY) / 2 : targetPos.y - minY,
    };
}

/**
 * DEC-3: `copy` always generates new ids. `cut` reuses the original ids only
 * when every node id and edge id is actually free in the live graph.
 */
export function planClipboardIdMap(
    intent: ClipboardIntent,
    nodes: Node[],
    edges: Edge[],
    existingNodeIds: Set<string>,
    existingEdgeIds: Set<string>,
    createNodeId: (type: string) => string = generateNodeId,
    createEdgeId: () => string = generateEdgeId
): { idMap: Map<string, string>; reused: boolean } {
    const allNodeIdsFree = nodes.every(node => !existingNodeIds.has(node.id));
    const allEdgeIdsFree = edges.every(edge => !existingEdgeIds.has(edge.id));
    const reused = intent === 'cut' && allNodeIdsFree && allEdgeIdsFree;

    const idMap = new Map<string, string>();

    nodes.forEach(node => {
        idMap.set(node.id, reused ? node.id : createNodeId(node.type || 'baseNode'));
    });
    edges.forEach(edge => {
        idMap.set(edge.id, reused ? edge.id : createEdgeId());
    });

    return { idMap, reused };
}

/** Applies the id map, parent mapping and paste offset to buffered nodes. */
export function buildClipboardNodes(
    layout: ClipboardLayoutItem[],
    idMap: Map<string, string>,
    offset: XYPosition
): Node[] {
    return layout.map(item => {
        const id = idMap.get(item.node.id) ?? item.node.id;
        const parentId = item.parentId ? idMap.get(item.parentId) : undefined;

        return {
            ...item.node,
            id,
            ...(parentId ? { parentId } : { parentId: undefined }),
            // Each paste owns its data tree; downstream mutations must not leak
            // into the clipboard buffer or into a sibling paste (DEC-5/§6.9).
            data: deepCloneWithFallback(item.node.data),
            position: item.isRoot
                ? { x: item.position.x + offset.x, y: item.position.y + offset.y }
                : { x: item.position.x, y: item.position.y },
            selected: true,
        };
    });
}

/** Rebuilds internal edges against the new endpoint ids. */
export function buildClipboardEdges(edges: Edge[], idMap: Map<string, string>): Edge[] {
    return edges.flatMap(edge => {
        const source = idMap.get(edge.source);
        const target = idMap.get(edge.target);
        const id = idMap.get(edge.id);
        if (!source || !target || !id) return [];

        return [{
            ...edge,
            id,
            source,
            target,
            selected: true,
        }];
    });
}

/** ADD_NODE (always with initialValue) followed by CONNECT. */
export function buildInsertTransactions(nodes: Node[], edges: Edge[]): Transaction[] {
    return [
        ...nodes.map(node => ({
            type: 'ADD_NODE',
            payload: { ...node, initialValue: node.data?.value },
        } as Transaction)),
        ...edges.map(edge => ({ type: 'CONNECT', payload: edge } as Transaction)),
    ];
}

/** DISCONNECT followed by REMOVE_NODE (history inverse order). */
export function buildRemoveTransactions(nodes: Node[], edges: Edge[]): Transaction[] {
    return [
        ...edges.map(edge => ({ type: 'DISCONNECT', payload: edge.id } as Transaction)),
        ...nodes.map(node => ({ type: 'REMOVE_NODE', payload: node.id } as Transaction)),
    ];
}

/**
 * Builds the whole paste transaction pair. Returns null for an empty buffer so
 * callers never write a `Paste 0 nodes` history entry (§6.3).
 */
export function planPaste(args: {
    buffer: ClipboardBuffer | null;
    liveNodes: Node[];
    liveEdges: Edge[];
    targetPos?: XYPosition;
    createNodeId?: (type: string) => string;
    createEdgeId?: () => string;
}): PastePlan | null {
    const { buffer, liveNodes, liveEdges, targetPos, createNodeId, createEdgeId } = args;
    if (!buffer || buffer.nodes.length === 0) return null;

    const layout = computeClipboardLayout(buffer.nodes, liveNodes);
    const offset = computePasteOffset(layout, targetPos);
    const { idMap, reused } = planClipboardIdMap(
        buffer.intent,
        buffer.nodes,
        buffer.edges,
        new Set(liveNodes.map(node => node.id)),
        new Set(liveEdges.map(edge => edge.id)),
        createNodeId,
        createEdgeId
    );

    const nodes = buildClipboardNodes(layout, idMap, offset);
    const edges = buildClipboardEdges(buffer.edges, idMap);
    if (nodes.length === 0) return null;

    const selectedLiveNodes = liveNodes.filter(node => node.selected);
    const deselectTxs: Transaction[] = selectedLiveNodes.map(node => ({
        type: 'UPDATE_NODE_DATA',
        payload: { id: node.id, data: { selected: false } },
    } as Transaction));
    const reselectTxs: Transaction[] = selectedLiveNodes.map(node => ({
        type: 'UPDATE_NODE_DATA',
        payload: { id: node.id, data: { selected: true } },
    } as Transaction));

    return {
        nodes,
        edges,
        offset,
        reusedIds: reused,
        forward: [...deselectTxs, ...buildInsertTransactions(nodes, edges)],
        inverse: [...buildRemoveTransactions(nodes, edges), ...reselectTxs],
    };
}
