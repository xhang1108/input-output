import type { Edge, Node } from '@xyflow/react';

export interface ImportSnapshot {
    nodes: Node[];
    edges: Edge[];
}

/**
 * One-shot safety net for replace-graph imports that clear undo history.
 *
 * This is deliberately not part of undo history: it holds a single pre-import
 * graph so the success toast can offer "Undo import". The captured node/edge
 * references are stored as-is — the canvas replaces its arrays instead of
 * mutating nodes in place, so a deep clone would only cost memory here.
 */
let snapshot: ImportSnapshot | null = null;

export function captureImportSnapshot(nodes: Node[], edges: Edge[]): void {
    snapshot = { nodes, edges };
}

export function getImportSnapshot(): ImportSnapshot | null {
    return snapshot;
}

export function clearImportSnapshot(): void {
    snapshot = null;
}
