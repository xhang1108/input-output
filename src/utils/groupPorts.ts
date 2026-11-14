import type { HandleConfig } from '../types/nodeDefinitions';
import type { BoundaryPort, GroupNodeData } from '../types/groupNode';

// P1 shared helper (GROUP_NODE_PLAN §5.4, §5.6): the boundary is the single
// source of truth for outer ports; data.handles is derived from it and never
// persisted (Serializer prune strips handles). Used by the load path
// (Brain.injectNodes) and shared with the P3 UI — one function, no drift.

function toHandle(port: BoundaryPort, type: 'target' | 'source'): HandleConfig {
    return {
        id: port.portId,
        type,
        variant: 'single',
        dataType: port.dataType ?? 'scalar',
        label: port.label,
    };
}

/** boundary (inputs left/target, outputs right/source) → HandleConfig[]. 1:1. */
export function hydrateGroupPorts(boundary: GroupNodeData['boundary']): HandleConfig[] {
    const inputs = boundary?.inputs ?? [];
    const outputs = boundary?.outputs ?? [];
    return [
        ...inputs.map((p) => toHandle(p, 'target')),
        ...outputs.map((p) => toHandle(p, 'source')),
    ];
}

/**
 * Load-path entry: rebuild handles from node data. Returns null unless the
 * data is group-shaped (has a boundary), so non-group nodes are untouched and
 * corrupt group data keeps whatever handles it already has.
 */
export function hydrateGroupNodeHandles(data: Record<string, unknown>): HandleConfig[] | null {
    const boundary = (data as { boundary?: GroupNodeData['boundary'] }).boundary;
    if (!boundary || !Array.isArray(boundary.inputs) || !Array.isArray(boundary.outputs)) {
        return null;
    }
    return hydrateGroupPorts(boundary);
}
