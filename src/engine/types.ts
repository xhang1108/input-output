/**
 * @file types.ts
 * @description Core type definitions for the Calctopus Hybrid Pull Engine.
 */

/**
 * Represents the current state of a node's calculation.
 */
export enum CalculationStage {
    IDLE = 'IDLE',          // No pending changes
    DIRTY = 'DIRTY',        // Upstream changed, cache invalid
    PENDING = 'PENDING',    // Pull request in flight (for async/UI feedback)
    RESOLVED = 'RESOLVED',  // Calculation finished, cache valid
    ERROR = 'ERROR'         // Calculation failed
}

/**
 * The "Soul" of the data: Symbolic representation (LaTeX/AST).
 */
export interface NodeSoul {
    ast: any;               // The internal Abstract Syntax Tree (MathJS format)
    latex: string;          // Renderable LaTeX string
}

/**
 * The "Body" of the data: Numeric/Concrete representation.
 */
export interface NodeBody {
    value: any;             // Number, Matrix, Array, or Boolean
    unit?: string;          // Optional physical unit (e.g., "m", "kg")
    errorCode?: string;     // Specific error code (e.g., "DIV_BY_ZERO")
}

/**
 * The unified data package flowing through the graph.
 */
export interface NodePayload {
    soul: NodeSoul;
    body: NodeBody;
    isDirty: boolean;
    lastUpdated: number;    // Epoch timestamp
}

/**
 * Standard Fallback Payload for errors or uninitialized states.
 */
export const FALLBACK_PAYLOAD: NodePayload = {
    soul: { ast: null, latex: '0' },
    body: { value: 0 },
    isDirty: true,
    lastUpdated: 0
};

/**
 * Registry metadata for a connection.
 */
export interface EngineLink {
    sourceId: string;
    sourceHandle?: string;
    targetId: string;
    targetHandle: string;
}

/**
 * Context for recursion, supporting packaging/scoping in the future.
 */
export interface PullContext {
    mode: 'value' | 'soul' | 'full';
    iterationCount: number;
    maxIterations: number;
}
