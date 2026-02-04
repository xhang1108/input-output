
/**
 * src/utils/Payloads.ts
 * 
 * Defines the standard data packet that travels through the network
 * during the Pull phase (Backward Finding).
 */

export interface Scope {
    [variableName: string]: number | string; // Variables collected along the path
}

export interface NodePayload {
    formula: string;  // For MathJS: Clean IDs (e.g., "node_abc + node_xyz")
    scope: Scope;     // Variable values for MathJS evaluation
    display: string;  // For Humans: Readable labels (e.g., "Rent + Tax")
    val: number;      // For Preview: Simple calculated number
}

// 👻 The "Ghost Payload"
// Returned when a connection exists but the source node is missing or fails,
// or when an input handle has no connection at all.
export const FALLBACK_PAYLOAD: NodePayload = {
    formula: '0',
    scope: {},
    display: '0',
    val: 0
};
