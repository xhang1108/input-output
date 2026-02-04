/**
 * @file types.ts
 * @description Core type definitions for the Calctopus Hybrid Pull Engine.
 */

/**
 * Represents the current state of a node's calculation.
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
 * Supports BigNumber (Precision) and TypedArrays (Scale).
 */
export interface NodeBody {
    value: any;             // MathJS BigNumber, Fraction, Matrix, or Unit
    typedValue?: Float64Array | null; // Optional buffer for high-scale matrix performance
    unit?: string;          // Optional physical unit (e.g., "m", "kg")
    errorCode?: string;     // Specific error code (e.g., "DIV_BY_ZERO")
}

/**
 * The unified data package flowing through the graph.
 */
export interface NodePayload {
    soul: NodeSoul;
    body: NodeBody;
    stage: CalculationStage;
    lastUpdated: number;    // Epoch timestamp
}

/**
 * Standard Fallback Payload for errors or uninitialized states.
 */
export const FALLBACK_PAYLOAD: NodePayload = {
    soul: { ast: null, latex: '0' },
    body: { value: 0 },
    stage: CalculationStage.DIRTY,
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
 * Variable Registry Entry for the "Option B" deduplication and GC.
 */
export interface VariableRegistryEntry {
    name: string;
    nodeIds: Set<string>;   // ids of InputNodes using this name (Reference Counting)
    currentValue: any;      // The unified value for this variable name
}

/**
 * Engine Events for the "Fusion-style" progress visualization.
 */
export type EngineEvent =
    | { type: 'NODE_DIRTY'; nodeId: string }
    | { type: 'NODE_RESOLVED'; nodeId: string; payload: NodePayload }
    | { type: 'CALC_START'; terminalNodeId: string }
    | { type: 'CALC_END'; terminalNodeId: string; duration: number };

/**
 * Context for recursion, supporting packaging/scoping in the future.
 */
export interface PullContext {
    mode: 'value' | 'soul' | 'full';
    scopeId?: string;       // For nested/wrapped logic
    trace: string[];        // To detect circularity during recursion
}
