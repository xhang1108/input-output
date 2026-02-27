import { Edge, Node } from '@xyflow/react';
import { NodePayload } from '../types/payload';



export type NodeLogic = Node & {
    data: Record<string, unknown>;
    value?: NodePayload; // Phase 2.1: Switched to Payload System
    opCode?: string;
    isInDirtyChain: boolean;
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
}

export interface MoveNodePayload {
    id: string;
    position: { x: number; y: number };
    oldPosition?: { x: number; y: number };
}

export interface UpdateValuePayload {
    id: string;
    value: unknown;
}

export interface BrainEvent {
    type: 'log' | 'graphChanged';
    payload: unknown;
}

export interface InjectableGraph {
    nodes: {
        id: string;
        type: string;
        position: { x: number; y: number };
        data?: Record<string, unknown>;
        value?: unknown;
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
