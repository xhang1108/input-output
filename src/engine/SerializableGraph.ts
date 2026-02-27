/**
 * 📦 Serializable Graph Types
 * 
 * Type definitions for data transported between Main Thread and Web Worker.
 * All types here MUST be JSON-serializable (no functions, no class instances).
 * 
 * Phase 4.1: Web Worker Migration
 */
import { PayloadValue, DataType, ASTNode, PayloadMetadata } from '../types/payload';

// ─── Serialized Node ───────────────────────────────────────────────
export interface SerializedNodeLogic {
    id: string;
    type: string;
    value: SerializedPayload | null;
    data: Record<string, unknown>;
    isDirty: boolean;
}

export interface SerializedPayload {
    type: DataType;
    value: PayloadValue;       // Must be dehydrated (no MathJS objects)
    symbol: ASTNode | null;
    meta: PayloadMetadata;
}

// ─── Serialized Edge ───────────────────────────────────────────────
export interface SerializedEdge {
    id: string;
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
}

// ─── Full Graph Snapshot (used for SYNC_GRAPH) ─────────────────────
export interface SerializedGraphSnapshot {
    nodes: SerializedNodeLogic[];
    edges: SerializedEdge[];
}

// ─── Incremental Patch (used for EVAL) ────────────────────────────
export interface IncrementalPatch {
    /** IDs of nodes that need recalculation */
    dirtyNodeIds: string[];
    /** Nodes whose value or data changed (dehydrated) */
    updatedNodes?: SerializedNodeLogic[];
    /** Newly added nodes */
    addedNodes?: SerializedNodeLogic[];
    /** IDs of removed nodes */
    removedNodeIds?: string[];
    /** Newly added edges */
    addedEdges?: SerializedEdge[];
    /** IDs of removed edges */
    removedEdgeIds?: string[];
}

// ─── IPC Message Types ─────────────────────────────────────────────
import { MathConfig } from './mathConfig';

export type WorkerRequest =
    | { type: 'INIT'; msgId: number; config: MathConfig }
    | { type: 'UPDATE_CONFIG'; msgId: number; config: MathConfig }
    | { type: 'SYNC_GRAPH'; msgId: number; snapshot: SerializedGraphSnapshot }
    | { type: 'EVAL'; msgId: number; epoch: number; patches: IncrementalPatch }
    | { type: 'SYNC_AND_EVAL'; msgId: number; epoch: number; snapshot: SerializedGraphSnapshot; dirtyNodeIds: string[] }
    | { type: 'CLEAR_STATE'; msgId: number }
    | { type: 'HEALTH_CHECK'; msgId: number; sampleNodeIds?: string[] };

export type WorkerResponse =
    | { type: 'READY' }
    | { type: 'RESULT'; epoch: number; patches: Record<string, SerializedPayload> }
    | { type: 'ERROR'; epoch: number; error: string }
    | { type: 'HEALTH'; nodeCount: number; edgeCount: number; sampleHashes?: Record<string, string> };
