/**
 * 📦 Calctopus Data Payload System
 * 
 * Defines the structure of data passed between nodes in the graph.
 * Transitions from simple `number` to a rich object capable of carrying
 * Matrices, Units, Symbols (LaTeX), and Errors.
 */

// Placeholder for Future Phases
// Phase 3: Symbolic AST Structure
export type ASTNode = {
    type: 'BinaryExpression' | 'UnaryExpression' | 'FunctionCall' | 'Identifier' | 'Literal' | 'ConditionalExpression' | 'TemplateLiteral';
    sourceId?: string; // Origin tracking
    operator?: string;
    left?: ASTNode;
    right?: ASTNode;
    test?: ASTNode;       // For ternary/conditional
    consequent?: ASTNode; // For ternary/conditional
    alternate?: ASTNode;  // For ternary/conditional
    argument?: ASTNode;
    args?: ASTNode[];
    parts?: (string | ASTNode)[]; // For TemplateLiteral
    name?: string;
    value?: number | string | boolean;
    unit?: string; // Symbolic unit
};
export type Matrix = unknown;  // Will be mathjs.Matrix in Phase 2.3

export enum DataType {
    Scalar = 'scalar',
    Matrix = 'matrix',
    Vector = 'vector', // Specialized 1D Matrix
    Unit = 'unit',
    String = 'string',
    Boolean = 'boolean',
    Error = 'error',
    Trigger = 'trigger', // For events/pulses
    Object = 'object',   // Generic JSON
    Symbolic = 'symbolic' // For algebraic expressions, equations, etc.
}

// Strict union type for value (removing 'any' progressively)
export type PayloadValue = number | string | boolean | Matrix | ASTNode | null;

export interface PayloadMetadata {
    /** Matrix dimensions [rows, cols] */
    dimensions?: [number, number];

    /** Physics unit (e.g., "kg", "m/s^2") */
    unit?: string;

    /** Error code or message if type is Error */
    error?: string;

    /** Handle-specific metadata overrides */
    handleMeta?: Record<string, PayloadMetadata>;

    /** arbitrary extra data */
    [key: string]: unknown;
}

export interface NodePayload {
    /** The high-level data type for UI rendering and logic compatibility */
    type: DataType;

    /** The actual data value (Serializable preferred) */
    value: PayloadValue;

    /** The symbolic representation for LaTeX generation (Phase 3) */
    symbol: ASTNode | null;

    /** Metadata: Dimensions, Units, etc. */
    meta: PayloadMetadata;
}
