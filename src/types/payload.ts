/**
 * Input-Output Data Payload System
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
    meta?: Record<string, any>; // [1.2.0] Extra metadata for rendering (e.g. log base)
};
export type Matrix = unknown;  // Will be mathjs.Matrix in Phase 2.3

export enum DataType {
    Scalar = 'scalar',
    Array = 'array',       // Unified Tensor (Vector, Matrix, ND-Array)
    Unit = 'unit',
    String = 'string',
    Boolean = 'boolean',
    Symbolic = 'symbolic', // For algebraic expressions, equations, etc.
    Color = 'color',       // HEX/HSL/RGBA visual types
    Object = 'object',     // Structured data (Color results, metadata bundles)
    Error = 'error',       // Error states
    Any = 'any',           // Universal/Undetermined slot

    /** @deprecated Use Array with Rank 2 */
    Matrix = 'matrix',
}

// Strict union type for value (removing 'any' progressively)
export type PayloadValue = number | string | boolean | unknown | ASTNode | null;

export interface PayloadMetadata {
    /** Array dimensions [d1, d2, ... dn] (e.g., [3] for Vector, [3, 3] for Matrix) */
    dimensions?: number[];

    /** Tensor Rank (0=Scalar, 1=Vector, 2=Matrix) */
    rank?: number;

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


