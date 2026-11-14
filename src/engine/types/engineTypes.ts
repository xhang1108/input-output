import { Edge, Node } from '@xyflow/react';
import { NodePayload } from '@/types/payload';
import type { GroupNodeData, LeanEdge, LeanNode } from '@/types/groupNode';



export interface VisualState {
    muted: boolean;
    visualTick: number; // For time-based animations scaled by engine
}

export type NodeLogic = Node & {
    data: Record<string, unknown>;
    value?: NodePayload; // Phase 2.1: Switched to Payload System
    selected: boolean;
    isInDirtyChain: boolean;
    position: { x: number; y: number };
    visualState?: VisualState;
    parentId?: string; // Phase 4.1: Tree-based Coordinate System
    /** UI-reported bounding box (absolute canvas coords). Written by useContentMetrics. */
    boundingBox?: { width: number; height: number; x: number; y: number };
    /** Diagnostic: track why a node was marked dirty. */
    lastUpdatedProperty?: string;
};

export interface GraphState {
    nodes: Map<string, NodeLogic>;
    edges: Edge[];

}

export type TransactionType =
    | 'ADD_NODE'
    | 'REMOVE_NODE'
    | 'CONNECT'
    | 'DISCONNECT'
    | 'UPDATE_VALUE'

    | 'UPDATE_NODE_DATA'
    | 'RESIZE_NODE'
    | 'MOVE_NODE'
    | 'REORDER_EDGES'
    | 'PATCH_SUBGRAPH'
    | 'BATCH';

export interface Transaction {
    type: TransactionType;
    payload: unknown;
}

export interface UpdateNodeDataAction {
    type: 'UPDATE_NODE_DATA';
    payload: { id: string; data: Record<string, unknown> };
}

// GROUP_NODE_PLAN F1 (diff-inverse): in-place patch of a group node's
// subGraph. `put` carries full previous LeanNodes for deleted/modified
// entries, `remove` carries only ids of added entries. `edges` (full array)
// is present only when the edge set changed; `boundary`/`compiled` carry the
// previous version when supplied.
export interface PatchSubGraphPayload {
    id: string;
    put: LeanNode[];
    remove: string[];
    boundary?: GroupNodeData['boundary'];
    compiled?: GroupNodeData['compiled'];
    edges?: LeanEdge[];
}

export interface PatchSubGraphAction {
    type: 'PATCH_SUBGRAPH';
    payload: PatchSubGraphPayload;
}

export interface AddNodePayload {
    id: string;
    initialValue?: unknown;
    type?: string;
    data?: Record<string, unknown>;
    position?: { x: number; y: number };
    parentId?: string;
    width?: number;
    height?: number;
}

export interface MoveNodePayload {
    id: string;
    position: { x: number; y: number };
    /** `null` explicitly detaches from the current parent. */
    parentId?: string | null;
    /** Bypasses the deadzone; used by history restores only. */
    force?: boolean;
}

export interface UpdateValuePayload {
    id: string;
    value: unknown;
}

export interface ResizeNodePayload {
    id: string;
    width: number;
    height: number;
}

export interface BrainEvent {
    type: 'log' | 'graphChanged';
    payload: unknown;
}

export interface InjectableGraph {
    hasExplicitPositions?: boolean; // Signal from Parser to Brain to skip auto-layout
    nodes: {
        id: string;
        type: string;
        position: { x: number; y: number };
        data?: Record<string, unknown>;
        value?: unknown;
        parentId?: string;
        width?: number;
        height?: number;
    }[];
    edges: {
        id: string;
        source: string;
        sourceHandle: string;
        target: string;
        targetHandle: string;
        type?: string;
        data?: Record<string, unknown>;
    }[];
}

/**
 * ️ [V1.0] Master Project Data format for serialization.
 */
export interface ProjectData extends InjectableGraph {
    version?: string;
    timestamp?: number;
    mathPrecision?: number;
    settings?: Record<string, any>;
    viewport?: { x: number; y: number; zoom: number };
}

