
import { Edge, Node } from '@xyflow/react';
import { NodePayload } from '../types/payload';

export type ComputationMode = 'scientific' | 'engineering';

export interface NodeLogic {
    id: string;
    type?: string;
    value: NodePayload; // Phase 2.1: Switched to Payload System
    data?: any;
    position?: { x: number; y: number };
    formula?: string;
    isDirty: boolean;
}

export interface GraphState {
    nodes: Map<string, NodeLogic>;
    edges: Edge[];
    mode: ComputationMode;
}

export type TransactionType =
    | 'ADD_NODE'
    | 'REMOVE_NODE'
    | 'CONNECT'
    | 'DISCONNECT'
    | 'UPDATE_VALUE'
    | 'SET_MODE'
    | 'UPDATE_NODE_DATA'
    | 'MOVE_NODE'
    | 'BATCH';

export interface Transaction {
    type: TransactionType;
    payload: any;
}

export interface BrainEvent {
    type: 'modeChanged' | 'log' | 'graphChanged';
    payload: any;
}
