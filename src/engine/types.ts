
import { Edge, Node } from '@xyflow/react';

export type ComputationMode = 'scientific' | 'engineering';

export interface NodeLogic {
    id: string;
    type?: string; // Phase 1.2: Added type for evaluation registry
    value: any; // Will be BigNumber or number depending on mode
    data?: any; // Phase 2.0: For storing node-specific settings (e.g. Op type)
    position?: { x: number; y: number }; // Phase 1.4: UI Position for Undo/Redo
    formula?: string;
    isDirty: boolean;
    // We can add more logic-specific fields here (e.g. AST segment)
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
