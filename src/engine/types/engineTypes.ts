import { Edge, Node } from '@xyflow/react';
import { NodePayload } from '@/types/payload';



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
    | 'BATCH';

export interface Transaction {
    type: TransactionType;
    payload: unknown;
}

export interface UpdateNodeDataAction {
    type: 'UPDATE_NODE_DATA';
    payload: { id: string; data: Record<string, unknown> };
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
    parentId?: string;
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

