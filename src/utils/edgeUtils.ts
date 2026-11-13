import type { Edge } from '@xyflow/react';

/**
 * Appends only edges whose id is not already present and drops duplicate ids
 * from the current array. Preserves array identity when nothing changes.
 * Used by relink's failure path where the edge is usually still in the store
 * and a blind append would create a duplicate key.
 */
export function appendMissingEdges(current: Edge[], candidates: Edge[]): Edge[] {
    const seen = new Set<string>();
    const result: Edge[] = [];
    let changed = false;

    for (const edge of current) {
        if (seen.has(edge.id)) {
            changed = true;
            continue;
        }
        seen.add(edge.id);
        result.push(edge);
    }

    for (const edge of candidates) {
        if (seen.has(edge.id)) continue;
        seen.add(edge.id);
        result.push(edge);
        changed = true;
    }

    return changed ? result : current;
}

/**
 * Reconciles the UI edge array to the Brain-owned array.
 *
 * Brain decides which edges exist and their order; the UI object is kept for
 * matching ids so view-only data (pathType, highlight, active) survives.
 * UI-only edges are dropped. Used after silent undo/redo restores, where a
 * rejected CONNECT would otherwise leave a ghost edge on the canvas.
 */
export function reconcileEdgesWithBrain(
    uiEdges: readonly Edge[],
    brainEdges: readonly Edge[]
): Edge[] {
    const uiById = new Map(uiEdges.map(e => [e.id, e]));
    return brainEdges.map(brainEdge => uiById.get(brainEdge.id) ?? brainEdge);
}
