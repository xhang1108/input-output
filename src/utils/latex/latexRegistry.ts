/**
 * 🛡️ [V1.0] LaTeX Authority Registry
 * 
 * The Single Source of Truth for mapping between:
 * LaTeX Commands <-> MathEngine Operations <-> Node Types (MA-*)
 */

export interface LatexNodeConfig {
    type: string;             // Node Type (e.g., MA-01)
    op: string;               // Engine Operation (e.g., ADD)
    label: string;            // UI Label
    latex: string[];          // List of LaTeX commands or operators
    category: string;
    handleMapping?: Record<number, string>; // AST Param Index -> Handle ID
    initialData?: Record<string, any>;      // Default data properties (e.g., mode)
}

export const LATEX_REGISTRY: LatexNodeConfig[] = [
    // --- Basic Math (MA-01) ---
    { type: 'MA-01', op: 'ADD', label: 'Add', latex: ['+', 'plus'], category: 'Arithmetic' },
    { type: 'MA-01', op: 'SUB', label: 'Subtract', latex: ['-', 'minus'], category: 'Arithmetic' },
    { type: 'MA-01', op: 'MUL', label: 'Multiply', latex: ['*', '\\times', '\\cdot', 'times'], category: 'Arithmetic' },
    { type: 'MA-01', op: 'DIV', label: 'Divide', latex: ['/', '\\div', '\\frac', 'frac', 'divide'], category: 'Arithmetic', handleMapping: { 0: 'in_a', 1: 'in_b' } },

    // --- Advanced Math (MA-02) ---
    { type: 'MA-02', op: 'POW', label: 'Power', latex: ['^', 'pow', 'power'], category: 'Exponents', handleMapping: { 0: 'in_a', 1: 'in_b' } },
    { type: 'MA-02', op: 'SQRT', label: 'Square Root', latex: ['\\sqrt', 'sqrt'], category: 'Exponents' },
    { type: 'MA-02', op: 'ABS', label: 'Absolute', latex: ['\\abs', 'abs'], category: 'Basic' },
    { type: 'MA-02', op: 'NEG', label: 'Negate', latex: ['negate'], category: 'Basic' },

    // --- Logarithm (MA-03) ---
    { type: 'MA-03', op: 'LN', label: 'Natural Log', latex: ['\\ln', 'ln'], category: 'Logarithms' },
    { type: 'MA-03', op: 'LOG10', label: 'Log base 10', latex: ['\\log', 'log'], category: 'Logarithms' },
    { type: 'MA-03', op: 'LOGN', label: 'Log base N', latex: ['logn'], category: 'Logarithms' },

    // --- Trigonometry (MA-04) ---
    { type: 'MA-04', op: 'SIN', label: 'Sine', latex: ['\\sin', 'sin'], category: 'Circular' },
    { type: 'MA-04', op: 'COS', label: 'Cosine', latex: ['\\cos', 'cos'], category: 'Circular' },
    { type: 'MA-04', op: 'TAN', label: 'Tangent', latex: ['\\tan', 'tan'], category: 'Circular' },
    { type: 'MA-04', op: 'ASIN', label: 'Arcsine', latex: ['\\asin', '\\arcsin', 'asin'], category: 'Inverse' },
    { type: 'MA-04', op: 'ACOS', label: 'Arccosine', latex: ['\\acos', '\\arccos', 'acos'], category: 'Inverse' },
    { type: 'MA-04', op: 'ATAN', label: 'Arctangent', latex: ['\\atan', '\\arctan', 'atan'], category: 'Inverse' },
    { type: 'MA-04', op: 'SINH', label: 'Sinh', latex: ['\\sinh', 'sinh'], category: 'Hyperbolic' },
    { type: 'MA-04', op: 'COSH', label: 'Cosh', latex: ['\\cosh', 'cosh'], category: 'Hyperbolic' },

    // --- Round / Divisibility (MA-05, MA-07) ---
    { type: 'MA-05', op: 'ROUND', label: 'Round', latex: ['\\round', 'round'], category: 'Rounding' },
    { type: 'MA-05', op: 'FLOOR', label: 'Floor', latex: ['\\floor', 'floor'], category: 'Rounding' },
    { type: 'MA-05', op: 'CEIL', label: 'Ceil', latex: ['\\ceil', 'ceil'], category: 'Rounding' },
    { type: 'MA-07', op: 'MOD', label: 'Modulo', latex: ['%', '\\mod', 'mod'], category: 'Arithmetic' },
    { type: 'MA-08', op: 'COMB', label: 'Comb', latex: ['\\binom', 'nCr', 'comb'], category: 'Combinatorics' },

    // --- Calculus (CL-*) ---
    { type: 'CL-01', op: 'DERIVATIVE', label: 'Derivative', latex: ['\\diff', 'diff', 'derivative'], category: 'Calculus' },
    { type: 'CL-02', op: 'INTEGRAL', label: 'Integral', latex: ['\\int', 'int', 'integral'], category: 'Calculus', initialData: { mode: 'indefinite' } },
    { type: 'CL-03', op: 'LIMIT', label: 'Limit', latex: ['\\lim', 'lim', 'limit'], category: 'Calculus' },
    { type: 'CL-04', op: 'SOLVE', label: 'Solver', latex: ['\\solve', 'solve'], category: 'Calculus' },

    // --- Transform & Field (TR-*) ---
    { type: 'TR-04', op: 'GRADIENT', label: 'Gradient', latex: ['\\nabla', 'grad', 'nabla'], category: 'Transform', handleMapping: { 0: 'in_a' }, initialData: { mode: 'gradient' } },
    { type: 'TR-04', op: 'CURL', label: 'Curl', latex: ['curl'], category: 'Transform', handleMapping: { 0: 'in_a' }, initialData: { mode: 'direct' } },
    { type: 'TR-06', op: 'Mean', label: 'Mean', latex: ['\\mean', 'mean', 'avg'], category: 'Statistics' },

    // --- Matrix & Vectors (DT-*) ---
    { type: 'DT-06', op: 'INV', label: 'Inverse', latex: ['inv', 'inverse'], category: 'Linear Algebra' },
    { type: 'DT-06', op: 'DET', label: 'Determinant', latex: ['det', 'determinant'], category: 'Linear Algebra' },
    { type: 'DT-05', op: 'DOT', label: 'Dot Product', latex: ['\\cdot', 'dot'], category: 'Geometry' },
    { type: 'DT-05', op: 'CROSS', label: 'Cross Product', latex: ['\\times', 'cross'], category: 'Geometry' },
    { type: 'DT-05', op: 'NORM', label: 'Norm', latex: ['\\Vert', 'norm'], category: 'Geometry' },

    // --- Logic & Comparisons (LG-01) ---
    { type: 'LG-01', op: 'AND', label: 'AND', latex: ['\\land', '&&', 'and'], category: 'Logic', handleMapping: { 0: 'in_a', 1: 'in_b' } },
    { type: 'LG-01', op: 'OR', label: 'OR', latex: ['\\lor', '||', 'or'], category: 'Logic', handleMapping: { 0: 'in_a', 1: 'in_b' } },
    { type: 'LG-01', op: 'NOT', label: 'NOT', latex: ['\\neg', '!', 'not'], category: 'Logic', handleMapping: { 0: 'in_a' } },
    { type: 'LG-01', op: 'XOR', label: 'XOR', latex: ['\\oplus', 'xor'], category: 'Logic', handleMapping: { 0: 'in_a', 1: 'in_b' } },
    { type: 'LG-01', op: 'EQ', label: 'Equal', latex: ['==', 'equal'], category: 'Logic', handleMapping: { 0: 'in_a', 1: 'in_b' } },
    { type: 'LG-01', op: 'NEQ', label: 'Not Equal', latex: ['!=', '\\neq', 'neq'], category: 'Logic', handleMapping: { 0: 'in_a', 1: 'in_b' } },
    { type: 'LG-01', op: 'GT', label: 'Greater', latex: ['>', 'gt'], category: 'Logic', handleMapping: { 0: 'in_a', 1: 'in_b' } },
    { type: 'LG-01', op: 'LT', label: 'Less', latex: ['<', 'lt'], category: 'Logic', handleMapping: { 0: 'in_a', 1: 'in_b' } },
    { type: 'LG-01', op: 'GEQ', label: 'Greater Equal', latex: ['\\geq', '>=', 'geq'], category: 'Logic', handleMapping: { 0: 'in_a', 1: 'in_b' } },
    { type: 'LG-01', op: 'LEQ', label: 'Less Equal', latex: ['\\leq', '<=', 'leq'], category: 'Logic', handleMapping: { 0: 'in_a', 1: 'in_b' } },

    // --- Constants (IN-06) ---
    { type: 'IN-06', op: 'pi', label: 'Pi', latex: ['\\pi', 'pi'], category: 'Constants' },
    { type: 'IN-06', op: 'e', label: 'Euler', latex: ['e'], category: 'Constants' },
    { type: 'IN-06', op: 'phi', label: 'Golden Ratio', latex: ['\\phi', 'phi'], category: 'Constants' },
    { type: 'IN-06', op: 'tau', label: 'Tau', latex: ['\\tau', 'tau'], category: 'Constants' },
];

/**
 * 🛡️ Utility: Finds a node configuration by a LaTeX token.
 */
export function findConfigByLatex(token: string): LatexNodeConfig | undefined {
    const t = token.toLowerCase();
    return LATEX_REGISTRY.find(c =>
        c.op.toLowerCase() === t ||
        c.latex.some(l => l.toLowerCase() === t || l.toLowerCase() === `\\${t}`)
    );
}

/**
 * 🛡️ Utility: Finds a configuration by Engine Operation name.
 */
export function findConfigByOp(op: string): LatexNodeConfig | undefined {
    return LATEX_REGISTRY.find(c => c.op.toUpperCase() === op.toUpperCase());
}
