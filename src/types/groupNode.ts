import type { HandleDataType } from './nodeDefinitions';

// Lean subgraph model (GROUP_NODE_PLAN §5.1, P0).
// Only JSON-serializable fields. Never stores value / selected /
// isInDirtyChain / handles — those are runtime or derived state.

export interface LeanNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
}

export interface LeanEdge {
    id: string;
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
}

export interface SubGraph {
    nodes: LeanNode[];
    edges: LeanEdge[];
}

export interface BoundaryPort {
    // Stable dedup key derived from the EXTERNAL edge, not the inner node:
    // input  = `in_${sourceId}__${sourceHandle}`,
    // output = `out_${targetId}__${targetHandle}`.
    // Fan-in of one external edge into several inner nodes merges into a
    // single port, so regrouping the same graph yields identical IDs and
    // undo/redo plus save-reload stay stable.
    portId: string;
    innerNodeId: string;
    innerHandle: string;
    // Reuses HandleDataType (types/nodeDefinitions.ts) so handleUtils color chain stays shared.
    dataType: HandleDataType;
    label?: string;
    // Input ports only (D10: grouped Slider moves out of subGraph into a port).
    defaultValue?: number | string | boolean;
    constraints?: { min?: number; max?: number; step?: number };
}

export interface GroupNodeData {
    label: string;
    // D2: no nested group/frame inside. Rejection is documented here;
    // runtime validation lands in P1.
    subGraph: SubGraph;
    // Single source of truth for outer ports; data.handles is derived from it (P1 hydrate).
    boundary: { inputs: BoundaryPort[]; outputs: BoundaryPort[] };
    // E3: compiled code lives in memory cache only (GroupCodeCache, P2) and is
    // NEVER persisted — archives store structHash + precision + allowlistVersion,
    // then recompile on load.
    compiled?: { structHash: string; precision: 16 | 32 | 64; allowlistVersion: number };
    ui?: { collapsed: boolean };
}
