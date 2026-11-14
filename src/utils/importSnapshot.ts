import type { Edge, Node } from '@xyflow/react';

export interface ImportSnapshot {
    nodes: Node[];
    edges: Edge[];
}

/**
 * One-shot safety net for replace-graph imports that clear undo history.
 *
 * This is deliberately not part of undo history: it holds a single pre-import
 * graph so the success toast can offer "Undo import". Node/edge references are
 * kept as captured — the canvas replaces its arrays instead of mutating nodes.
 *
 * Sizes are the one exception: `brain.injectNodes` reads `width`/`height` and
 * ignores `measured`, so a node that was only ever measured by the DOM would
 * lose its size when restored. We fill missing dimensions at capture time
 * (copy-on-write, never mutating the live node).
 */
let snapshot: ImportSnapshot | null = null;

function withConcreteSize(node: Node): Node {
    if (node.width !== undefined && node.height !== undefined) return node;

    const width = node.width ?? node.measured?.width;
    const height = node.height ?? node.measured?.height;
    if (width === undefined && height === undefined) return node;

    const next: Node = { ...node };
    if (node.width === undefined && width !== undefined) next.width = width;
    if (node.height === undefined && height !== undefined) next.height = height;
    return next;
}

export function captureImportSnapshot(nodes: Node[], edges: Edge[]): void {
    const normalized = nodes.map(withConcreteSize);
    const changed = normalized.some((node, index) => node !== nodes[index]);
    snapshot = { nodes: changed ? normalized : nodes, edges };
}

export function getImportSnapshot(): ImportSnapshot | null {
    return snapshot;
}

export function clearImportSnapshot(): void {
    snapshot = null;
}
