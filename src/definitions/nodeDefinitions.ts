import { Position } from '@xyflow/react';
import { NodeDefinition } from '../types/NodeDefinition';

/**
 * Central Node Definition Registry
 * 
 * This is the SINGLE SOURCE OF TRUTH for all node configurations.
 * To add a new node:
 *   1. Add a NodeDefinition here
 *   2. Register its evaluator in NodeRegistry.ts
 *   3. (Optional) Create a custom UI component if it needs special controls
 *   4. Register its UI component in Body.tsx nodeTypes
 * 
 * For nodes that use the generic BaseNode (no custom UI), steps 3 & 4 are skipped.
 * 
 * NOTE: `nodeType` maps to React Flow's node type (used in Body.tsx nodeTypes).
 * Multiple definitions can share the same `nodeType` (e.g. Add/Sub/Mul/Div all use 'MA-01').
 */
export const NODE_DEFINITIONS: NodeDefinition[] = [
    // ─── 1. Input Family ───────────────────────────────────────────
    {
        id: 'IN-01',
        label: 'Number',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { type: 'scalar', value: { type: 'scalar', value: 0, symbol: null, meta: {} } },
        params: [
            { id: 'value', label: 'Value', type: 'number', step: 1 }
        ]
    },
    {
        id: 'IN-02',
        label: 'Slider',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar', y: '68%' }
        ],
        defaultData: {
            type: 'slider',
            value: { type: 'scalar', value: 50, symbol: null, meta: {} },
            min: 0, max: 100, step: 1
        },
        params: [
            { id: 'value', label: 'Value', type: 'number' },
            { id: 'min', label: 'Min', type: 'number' },
            { id: 'max', label: 'Max', type: 'number' },
            { id: 'step', label: 'Step', type: 'number', min: 0, hint: 'Drag increment' }
        ]
    },
    {
        id: 'IN-03',
        label: 'Color',
        category: 'Input',
        handles: [
            { id: 'hex', type: 'source', variant: 'single', dataType: 'color', label: 'HEX' },
            { id: 'rgb', type: 'source', variant: 'single', dataType: 'array', label: 'RGB' },
            { id: 'vec3', type: 'source', variant: 'single', dataType: 'array', label: 'Vec3' }
        ],
        defaultData: {
            type: 'color',
            value: { type: 'string', value: '#3b82f6', symbol: null, meta: {} }
        },
        params: [
            {
                id: 'depth',
                label: 'Bit Depth',
                type: 'select',
                options: [
                    { value: '8bit', label: '8-bit (0-255)' },
                    { value: '10bit', label: '10-bit (0-1023)' },
                    { value: '12bit', label: '12-bit (0-4095)' }
                ]
            },
            { id: 'value', label: 'Color', type: 'color' }
        ]
    },
    {
        id: 'IN-04',
        label: 'String',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'string' }
        ],
        defaultData: { type: 'string', value: { type: 'string', value: 'Hello', symbol: null, meta: {} } },
        params: [
            { id: 'value', label: 'Value', type: 'string' }
        ]
    },
    {
        id: 'IN-05', // Button
        label: 'Button',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'boolean' }
        ],
        defaultData: { type: 'button', value: false, mode: 'sticky' },
        params: [
            {
                id: 'mode', label: 'Mode', type: 'select', options: [
                    { label: 'Sticky (Toggle)', value: 'sticky' },
                    { label: 'Momentary (Hold)', value: 'momentary' }
                ]
            }
        ]
    },
    {
        id: 'IN-06',
        label: 'Constant',
        category: 'Input',
        handles: [
            { id: 'val', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', y: '72%' }
        ],
        defaultData: {
            val: 'pi',
            label: 'Constant'
        },
        params: [
            {
                id: 'val', label: 'Constant', type: 'select', options: [
                    { label: 'π (Pi)', value: 'pi', category: 'Mathematical' },
                    { label: 'e (Euler)', value: 'e', category: 'Mathematical' },
                    { label: 'φ (Golden Ratio)', value: 'phi', category: 'Mathematical' },
                    { label: 'τ (Tau)', value: 'tau', category: 'Mathematical' }
                ]
            }
        ]
    },
    {
        id: 'IN-07',
        label: 'Array Input',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'array' }
        ],
        defaultData: {
            rawExpression: '[[0,0,0],[0,0,0],[0,0,0]]',
            width: 152,
            height: 160
        },
        minWidth: 64,
        minHeight: 88,
        layoutMetadata: {
            uiOrigin: [0, 0],
            physicalAnchor: [0, 0]
        }
    },
    {
        id: 'IN-08',
        label: 'Abacus',
        category: 'Input',
        handles: [
            { id: 'val', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { type: 'abacus', digits: [0, 0, 0, 0, 0, 0, 0] },
        minWidth: 220,
        minHeight: 100,
        layoutMetadata: {
            uiOrigin: [0, 0],
            physicalAnchor: [0, 0]
        }
    },
    {
        id: 'IN-09',
        label: 'Expression',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'symbolic' }
        ],
        defaultData: {
            type: 'expression',
            code: '1 + 2'
        },
        minWidth: 200,
        layoutMetadata: {
            uiOrigin: [0, 0],
            physicalAnchor: [0, 0]
        },
        params: [
            { id: 'code', label: 'Expression', type: 'string', hint: 'Math e.g. 1 + 2' }
        ]
    },

    // ─── 2. Input ──────────────────────────────────────────────
    {
        id: 'IN-10',
        label: 'Random',
        category: 'Input',
        aliases: ['rand', 'noise', 'white'],
        handles: [
            {
                id: 'out', type: 'source', variant: 'single', dataType: 'scalar',
                dynamicColor: (data) => {
                    if (data.mode === 'matrix' || data.mode === 'vector') return 'array';
                    return 'scalar';
                }
            }
        ],
        defaultData: {
            type: 'random',
            mode: 'float',
            isFloat: true,
            min: 0,
            max: 1,
            rows: 3,
            cols: 3,
            length: 1,
            seed: Date.now()
        },
        params: [
            {
                id: 'mode', label: 'Output Mode', type: 'select', options: [
                    { label: 'Single Value', value: 'float' },
                    { label: 'Array (1D)', value: 'vector' },
                    { label: 'Array (2D)', value: 'matrix' }
                ]
            },
            { id: 'isFloat', label: 'Is Float', type: 'boolean' },
            { id: 'min', label: 'Min', type: 'number' },
            { id: 'max', label: 'Max', type: 'number' },
            { id: 'rows', label: 'Rows', type: 'number', min: 1, step: 1, hint: 'Array (2D) only', hidden: (d) => d.mode !== 'matrix' },
            { id: 'cols', label: 'Cols', type: 'number', min: 1, step: 1, hint: 'Array (2D) only', hidden: (d) => d.mode !== 'matrix' },
            { id: 'length', label: 'Length', type: 'number', min: 1, step: 1, hint: 'Array (1D) only', hidden: (d) => d.mode !== 'vector' }
        ]
    },
    {
        id: 'IN-11',
        label: 'Distributions',
        category: 'Input',
        aliases: ['gaussian', 'normal', 'uniform', 'probability'],
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'array' }
        ],
        defaultData: { mode: 'Normal', n: 100, p1: 0, p2: 1 },
        opTokens: ['NORMAL', 'UNIFORM', 'POISSON'],
        params: [
            {
                id: 'mode', label: 'Distribution', type: 'select', options: [
                    { label: 'Normal (Gaussian)', value: 'Normal' },
                    { label: 'Uniform', value: 'Uniform' },
                    { label: 'Poisson', value: 'Poisson' },
                    { label: 'Exponential', value: 'Exponential' }
                ]
            },
            { id: 'n', label: 'N', type: 'number', min: 1, step: 1, hint: 'Sample Count' },
            { id: 'p1', label: 'P1', type: 'number', hint: 'Mean / Min / Lambda' },
            { id: 'p2', label: 'P2', type: 'number', hint: 'StdDev / Max' }
        ]
    },

    {
        id: 'MA-01',
        label: 'Basic Math',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', variant: 'single', dataType: 'scalar', label: 'A' },
            { id: 'in_b', type: 'target', variant: 'single', dataType: 'scalar', label: 'B' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'ADD', label: 'Add' },
        aliases: ['add', 'sub', 'mul', 'div', '+', '-', '*', '/'],
        params: [
            {
                id: 'op', label: 'Operation', type: 'select', options: [
                    { label: 'Add (+)', value: 'ADD', category: 'Arithmetic' },
                    { label: 'Subtract (−)', value: 'SUB', category: 'Arithmetic' },
                    { label: 'Multiply (×)', value: 'MUL', category: 'Arithmetic' },
                    { label: 'Divide (÷)', value: 'DIV', category: 'Arithmetic' }
                ]
            }
        ]
    },
    {
        id: 'MA-02',
        label: 'Advanced Math',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', variant: 'single', dataType: 'scalar', label: 'Input' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'POW', label: 'Power' },
        aliases: ['pow', 'sqrt', 'abs', '^', 'root'],
        params: [
            {
                id: 'op', label: 'Operation', type: 'select', options: [
                    { label: 'Power (xⁿ)', value: 'POW', category: 'Exponents' },
                    { label: 'Square Root (√x)', value: 'SQRT', category: 'Exponents' },
                    { label: 'Absolute Value (|x|)', value: 'ABS', category: 'Basic' },
                    { label: 'Negate (−x)', value: 'NEG', category: 'Basic' },
                    { label: 'Sign', value: 'SIGN', category: 'Basic' }
                ]
            }
        ]
    },
    {
        id: 'MA-03',
        label: 'Logarithm',
        category: 'Math',
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'x' },
            { id: 'base', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Base' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'LN' },
        aliases: ['ln', 'log10', 'log2', 'log'],
        params: [
            {
                id: 'op', label: 'Mode', type: 'select', options: [
                    { label: 'Natural Log (ln)', value: 'LN', category: 'Logarithms' },
                    { label: 'Log Base 10 (log₁₀)', value: 'LOG10', category: 'Logarithms' },
                    { label: 'Log Base 2 (log₂)', value: 'LOG2', category: 'Logarithms' },
                    { label: 'Log Base N (logₙ)', value: 'LOGN', category: 'Logarithms' }
                ]
            }
        ]
    },
    {
        id: 'MA-04',
        label: 'Trigonometry',
        category: 'Math',
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Angle' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'SIN' },
        aliases: ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'trig'],
        params: [
            {
                id: 'op', label: 'Function', type: 'select', options: [
                    { label: 'Sine (sin)', value: 'SIN', category: 'Circular' },
                    { label: 'Cosine (cos)', value: 'COS', category: 'Circular' },
                    { label: 'Tangent (tan)', value: 'TAN', category: 'Circular' },
                    { label: 'Arcsine (asin)', value: 'ASIN', category: 'Inverse' },
                    { label: 'Arccosine (acos)', value: 'ACOS', category: 'Inverse' },
                    { label: 'Arctangent (atan)', value: 'ATAN', category: 'Inverse' },
                    { label: 'Atan2 (y, x)', value: 'ATAN2', category: 'Inverse' },
                    { label: 'Hyperbolic Sine (sinh)', value: 'SINH', category: 'Hyperbolic' },
                    { label: 'Hyperbolic Cosine (cosh)', value: 'COSH', category: 'Hyperbolic' }
                ]
            }
        ]
    },
    {
        id: 'MA-05',
        label: 'Round / Precision',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Input' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { precision: 0 },
        aliases: ['round', 'ceil', 'floor', 'trunc'],
        params: [
            {
                id: 'op', label: 'Mode', type: 'select', options: [
                    { label: 'Round (nearest)', value: 'ROUND', category: 'Rounding' },
                    { label: 'Floor (↓)', value: 'FLOOR', category: 'Rounding' },
                    { label: 'Ceiling (↑)', value: 'CEIL', category: 'Rounding' },
                    { label: 'Truncate', value: 'TRUNC', category: 'Rounding' }
                ]
            },
            { id: 'precision', label: 'Decimal Places', type: 'number', min: 0, max: 15, step: 1 }
        ]
    },
    {
        id: 'MA-06',
        label: 'Fraction',
        category: 'Math',
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' },
            { id: 'int', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'int' },
            { id: 'numerator', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'n' },
            { id: 'denominator', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'd' },
            { id: 'string', type: 'source', position: Position.Right, variant: 'single', dataType: 'string', label: 'Text' }
        ],
        defaultData: { mixed: false }
    },
    {
        id: 'MA-07',
        label: 'Divisibility & Primes',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'A' },
            { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'B' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'GCD' },
        aliases: ['gcd', 'lcm', 'mod', 'prime', 'modulo', 'number theory', 'divisibility'],
        params: [
            {
                id: 'op', label: 'Operation', type: 'select', options: [
                    { label: 'GCD', value: 'GCD' },
                    { label: 'LCM', value: 'LCM' },
                    { label: 'Modulo (A mod B)', value: 'MOD' },
                    { label: 'Is Prime?', value: 'ISPRIME' }
                ]
            }
        ]
    },
    {
        id: 'MA-08',
        label: 'Combinatorics',
        category: 'Math',
        handles: [
            { id: 'n', type: 'target', variant: 'single', dataType: 'scalar', label: 'n' },
            { id: 'r', type: 'target', variant: 'single', dataType: 'scalar', label: 'r' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'nCr' },
        opTokens: ['NCR', 'NPR'],
        params: [
            {
                id: 'op', label: 'Operation', type: 'select', options: [
                    { label: 'Combinations C(n,r)', value: 'nCr' },
                    { label: 'Permutations P(n,r)', value: 'nPr' },
                    { label: 'Factorial n!', value: 'FACTORIAL' }
                ]
            }
        ]
    },

    // ─── 4. Calculus ───────────────────────────────────────────
    {
        id: 'CL-01',
        label: 'Derivative',
        category: 'Calculus',
        handles: [
            { id: 'expr', type: 'target', variant: 'single', dataType: 'symbolic', label: 'f(x)' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'symbolic' }
        ],
        defaultData: { variable: 'x', order: 1 },
        aliases: ['d/dx', 'grad', 'nabla', 'curl', 'div', 'diff', 'derivative'],
        params: [
            { id: 'variable', label: 'Variable', type: 'string', hint: 'Differentiate with respect to (e.g. x, t)' },
            { id: 'order', label: 'Order', type: 'number', min: 1, max: 5, step: 1, hint: '1=first, 2=second derivative' }
        ]
    },
    {
        id: 'CL-02',
        label: 'Integral',
        category: 'Calculus',
        handles: [
            { id: 'expr', type: 'target', variant: 'single', dataType: 'symbolic', label: 'f(x)' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { variable: 'x', mode: 'indefinite', lower: '', upper: '' },
        aliases: ['int', 'integrate', 'integral'],
        params: [
            {
                id: 'mode', label: 'Mode', type: 'select', options: [
                    { label: 'Indefinite (∫f dx)', value: 'indefinite' },
                    { label: 'Definite (∫ₐᵇ f dx)', value: 'definite' }
                ]
            },
            { id: 'variable', label: 'Variable', type: 'string' },
            { id: 'lower', label: 'Lower Bound (a)', type: 'string', hint: 'Definite mode only', hidden: (d) => d.mode !== 'definite' },
            { id: 'upper', label: 'Upper Bound (b)', type: 'string', hint: 'Definite mode only', hidden: (d) => d.mode !== 'definite' }
        ]
    },
    {
        id: 'CL-03',
        label: 'Limit',
        category: 'Calculus',
        handles: [
            { id: 'expr', type: 'target', variant: 'single', dataType: 'symbolic', label: 'f(x)' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { variable: 'x', approach: '0', direction: 'both' },
        aliases: ['lim', 'limit'],
        params: [
            { id: 'variable', label: 'Variable', type: 'string' },
            { id: 'approach', label: 'Approaches', type: 'string', hint: 'e.g. 0, Infinity, pi' },
            {
                id: 'direction', label: 'Direction', type: 'select', options: [
                    { label: 'Both Sides', value: 'both' },
                    { label: 'Left (−)', value: 'left' },
                    { label: 'Right (+)', value: 'right' }
                ]
            }
        ]
    },
    {
        id: 'CL-04',
        label: 'Equation Solver',
        category: 'Calculus',
        handles: [
            { id: 'in', type: 'target', variant: 'capsule', dataType: 'symbolic', label: 'Eq', color: 'var(--color-symbolic)' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'symbolic', color: 'var(--color-symbolic)' }
        ],
        defaultData: { op: 'SOLVE' },
        aliases: ['eqn', 'solve', 'equation', 'nerdamer', 'solver']
    },
    {
        id: 'CL-05',
        label: 'ODE Solver',
        category: 'Calculus',
        handles: [
            { id: 'expr', type: 'target', variant: 'single', dataType: 'symbolic', label: "f(t,y)" },
            { id: 'out', type: 'source', variant: 'single', dataType: 'array' }
        ],
        defaultData: { method: 'RK4', t0: 0, tEnd: 10, y0: 1, stepSize: 0.01 },
        aliases: ['rk4', 'diffeq', 'differential equation'],
        params: [
            {
                id: 'method', label: 'Method', type: 'select', options: [
                    { label: 'RK4 (Runge-Kutta)', value: 'RK4' },
                    { label: 'Euler', value: 'EULER' }
                ]
            },
            { id: 't0', label: 't₀ (Start)', type: 'number' },
            { id: 'tEnd', label: 't End', type: 'number' },
            { id: 'y0', label: 'y₀ (Initial)', type: 'number' },
            { id: 'stepSize', label: 'Step Size', type: 'number', min: 0.0001, hint: 'Smaller = more accurate, slower' }
        ]
    },

    // ─── 5. Data & Structures ──────────────────────────────────────────
    {
        id: 'DT-01',
        label: 'Array Builder',
        category: 'Data & Structures',
        handles: [
            { id: 'in', type: 'target', variant: 'capsule', dataType: 'any', label: 'In' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'array' }
        ],
        defaultData: { axis: 0 },
        opTokens: ['BUILD', 'CONCAT'],
        params: [
            {
                id: 'op', label: 'Mode', type: 'select', options: [
                    { label: 'Build Array', value: 'BUILD' },
                    { label: 'Concatenate', value: 'CONCAT' }
                ]
            },
            {
                id: 'axis', label: 'Concat Axis', type: 'select', options: [
                    { label: 'Axis 0 (Rows)', value: 0 },
                    { label: 'Axis 1 (Cols)', value: 1 }
                ],
                hidden: (d) => d.op !== 'CONCAT'
            }
        ]
    },
    {
        id: 'DT-02',
        label: 'Array Extract',
        category: 'Data & Structures',
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'array' },
            { id: 'index', type: 'target', variant: 'single', dataType: 'scalar', label: 'Idx' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'any' }
        ],
        defaultData: { indexMode: '1D' },
        opTokens: ['EXTRACT', 'GET'],
        params: [
            {
                id: 'indexMode', label: 'Index Mode', type: 'select', options: [
                    { label: '1D (flat)', value: '1D', category: 'Extraction' },
                    { label: '2D (row, col)', value: '2D', category: 'Extraction' }
                ]
            }
        ]
    },
    {
        id: 'DT-03',
        label: 'List Utility',
        category: 'Data & Structures',
        handles: [
            { id: 'data', type: 'target', variant: 'single', dataType: 'array' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'array' }
        ],
        defaultData: { mode: 'Sort (Asc)' },
        opTokens: ['SORT', 'REVERSE', 'UNIQUE', 'CLEAN'],
        params: [
            {
                id: 'mode', label: 'Operation', type: 'select', options: [
                    { label: 'Sort Ascending', value: 'Sort (Asc)' },
                    { label: 'Sort Descending', value: 'Sort (Desc)' },
                    { label: 'Reverse', value: 'Reverse' },
                    { label: 'Unique (deduplicate)', value: 'Unique' },
                    { label: 'Clean (remove NaN)', value: 'Clean' }
                ]
            }
        ]
    },
    {
        id: 'DT-04',
        label: 'Set Operations',
        category: 'Data & Structures',
        handles: [
            { id: 'a', type: 'target', variant: 'single', dataType: 'array', label: 'A' },
            { id: 'b', type: 'target', variant: 'single', dataType: 'array', label: 'B' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'array' }
        ],
        defaultData: { mode: 'Union' },
        opTokens: ['UNION', 'INTERSECTION', 'DIFFERENCE'],
        aliases: ['set utils', 'union', 'intersection', 'difference'],
        params: [
            {
                id: 'mode', label: 'Operation', type: 'select', options: [
                    { label: 'Union (A ∪ B)', value: 'Union', category: 'Set Operations' },
                    { label: 'Intersection (A ∩ B)', value: 'Intersection', category: 'Set Operations' },
                    { label: 'Difference (A − B)', value: 'Difference', category: 'Set Operations' }
                ]
            }
        ]
    },
    {
        id: 'DT-05',
        label: 'Array Geometry',
        category: 'Data & Structures',
        handles: [
            { id: 'in_a', type: 'target', variant: 'single', dataType: 'array', label: 'A' },
            { id: 'in_b', type: 'target', variant: 'single', dataType: 'array', label: 'B' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'any' }
        ],
        defaultData: { op: 'DOT' },
        opTokens: ['DOT', 'CROSS'],
        aliases: ['dot', 'cross', 'norm', 'distance', 'dist'],
        params: [
            {
                id: 'op', label: 'Operation', type: 'select', options: [
                    { label: 'Dot Product', value: 'DOT', category: 'Products', aliases: ['dot'] },
                    { label: 'Cross Product', value: 'CROSS', category: 'Products', aliases: ['cross'] },
                    { label: 'Norm (magnitude)', value: 'NORM', category: 'Metrics', aliases: ['norm', 'magnitude', 'length'] },
                    { label: 'Distance', value: 'DISTANCE', category: 'Metrics', aliases: ['dist'] }
                ]
            }
        ]
    },
    {
        id: 'DT-06',
        label: 'Array Split',
        category: 'Data & Structures',
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'array' },
            { id: 'x', type: 'source', variant: 'single', dataType: 'scalar', label: 'X' },
            { id: 'y', type: 'source', variant: 'single', dataType: 'scalar', label: 'Y' },
            { id: 'z', type: 'source', variant: 'single', dataType: 'scalar', label: 'Z' },
            { id: 'w', type: 'source', variant: 'single', dataType: 'scalar', label: 'W' }
        ],
        defaultData: { mode: 'separate' },
        opTokens: ['SEPARATE', 'COMBINE'],
        aliases: ['separate', 'combine', 'split'],
        params: [
            {
                id: 'mode', label: 'Mode', type: 'select', options: [
                    { label: 'Separate (Arr → Scalar)', value: 'separate' },
                    { label: 'Combine (Scalar → Arr)', value: 'combine' }
                ]
            }
        ]
    },
    {
        id: 'DT-07',
        label: 'Array Calculus',
        category: 'Data & Structures',
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'array' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'any' }
        ],
        defaultData: { op: 'INV' },
        opTokens: ['DET', 'INV', 'TRANSPOSE', 'TRACE', 'QR', 'LU', 'LUP', 'EIGEN'],
        aliases: ['matrix tools', 'inv', 'det', 'transpose', 'trace', 'qr', 'lu', 'lup', 'eigen', 'svd'],
        params: [
            {
                id: 'op', label: 'Operation', type: 'select', options: [
                    { label: 'Inverse (A⁻¹)', value: 'INV', category: 'Linear Algebra', aliases: ['inv'] },
                    { label: 'Determinant (det A)', value: 'DET', category: 'Linear Algebra', aliases: ['det'] },
                    { label: 'Transpose (Aᵀ)', value: 'TRANSPOSE', category: 'Linear Algebra', aliases: ['transpose', 't', 'swap'] },
                    { label: 'Trace (tr A)', value: 'TRACE', category: 'Linear Algebra', aliases: ['trace'] },
                    { label: 'Eigenvalues (Sym)', value: 'EIGEN', category: 'Spectral', aliases: ['eigen', 'eig'] },
                    { label: 'QR Decomposition', value: 'QR', category: 'Decomposition', aliases: ['qr'] },
                    { label: 'LU Decomposition', value: 'LU', category: 'Decomposition', aliases: ['lu', 'lup'] }
                ]
            }
        ]
    },

    // ─── 6. Transform ──────────────────────────────────────────
    {
        id: 'TR-01',
        label: 'Unit',
        category: 'Transform',
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'scalar' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'unit' }
        ],
        defaultData: { type: 'unit', unit: 'm', customUnit: '' },
        params: [
            {
                id: 'unit', label: 'Unit', type: 'select', options: [
                    { label: 'Meter (m)', value: 'm' },
                    { label: 'Centimeter (cm)', value: 'cm' },
                    { label: 'Millimeter (mm)', value: 'mm' },
                    { label: 'Kilometer (km)', value: 'km' },
                    { label: 'Feet (ft)', value: 'ft' },
                    { label: 'Inch (in)', value: 'in' },
                    { label: 'Kilogram (kg)', value: 'kg' },
                    { label: 'Gram (g)', value: 'g' },
                    { label: 'Pound (lb)', value: 'lb' },
                    { label: 'Second (s)', value: 's' },
                    { label: 'Minute (min)', value: 'min' },
                    { label: 'Hour (h)', value: 'h' },
                    { label: 'Celsius (°C)', value: 'degC' },
                    { label: 'Fahrenheit (°F)', value: 'degF' },
                    { label: '--- Custom ---', value: 'CUSTOM' }
                ]
            },
            {
                id: 'customUnit',
                label: 'Custom Unit',
                type: 'string',
                hint: 'e.g. m/s, N*m, Pascal',
                hidden: (d) => d.unit !== 'CUSTOM'
            }
        ]
    },
    {
        id: 'TR-02',
        label: 'Base Converter',
        category: 'Transform',
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'any' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'string' }
        ],
        defaultData: { base: 'HEX' },
        params: [
            {
                id: 'base', label: 'Target Base', type: 'select', options: [
                    { label: 'Hexadecimal (16)', value: 'HEX' },
                    { label: 'Binary (2)', value: 'BIN' },
                    { label: 'Octal (8)', value: 'OCT' },
                    { label: 'Decimal (10)', value: 'DEC' },
                    { label: 'Duodecimal (12)', value: 'DUO' }
                ]
            }
        ]
    },
    {
        id: 'TR-03',
        label: 'Geometry',
        category: 'Transform',
        handles: [
            { id: 'in_a', type: 'target', variant: 'single', dataType: 'scalar', label: 'Radius' },
            { id: 'area', type: 'source', variant: 'single', dataType: 'scalar', label: 'Area' },
            { id: 'perimeter', type: 'source', variant: 'single', dataType: 'scalar', label: 'Perim' }
        ],
        defaultData: { shape: 'Circle' },
        opTokens: ['CIRCLE', 'QUAD', 'TRIANGLE'],
        params: [
            {
                id: 'shape', label: 'Shape', type: 'select', options: [
                    { label: 'Circle', value: 'Circle' },
                    { label: 'Rectangle / Square', value: 'Quad' },
                    { label: 'Triangle', value: 'Triangle' }
                ]
            }
        ]
    },
    {
        id: 'TR-04',
        label: 'Vector Field',
        category: 'Transform',
        handles: [
            { id: 'in_f', type: 'target', variant: 'single', dataType: 'symbolic', label: 'f' },
            { id: 'out_field', type: 'source', variant: 'single', dataType: 'array', label: 'Arrows' },
            { id: 'out_grad', type: 'source', variant: 'single', dataType: 'array', label: 'Grad' }
        ],
        defaultData: { mode: 'gradient', var1: 'x', var2: 'y', min: -5, max: 5, density: 10 },
        aliases: ['grad', 'gradient', 'vector field'],
        params: [
            {
                id: 'mode', label: 'Mode', type: 'select', options: [
                    { label: 'Gradient', value: 'gradient' },
                    { label: 'Direct Field', value: 'direct' }
                ]
            },
            { id: 'var1', label: 'Var 1', type: 'string' },
            { id: 'var2', label: 'Var 2', type: 'string' },
            { id: 'min', label: 'Range Min', type: 'number' },
            { id: 'max', label: 'Range Max', type: 'number' },
            { id: 'density', label: 'Density', type: 'number', min: 2, max: 50, step: 1 }
        ]
    },
    {
        id: 'TR-05',
        label: 'Smoothing',
        category: 'Transform',
        handles: [
            { id: 'data', type: 'target', variant: 'single', dataType: 'array' },
            { id: 'window', type: 'target', variant: 'single', dataType: 'scalar', label: 'Win' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'array' }
        ],
        defaultData: { windowMode: 3 },
        params: [
            { id: 'windowMode', label: 'Window Size', type: 'number', min: 1, max: 50, step: 1, hint: 'Odd number recommended' }
        ]
    },
    {
        id: 'TR-06',
        label: 'Statistics',
        category: 'Transform',
        handles: [
            { id: 'data', type: 'target', variant: 'single', dataType: 'array' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'Mean' },
        opTokens: ['MEAN', 'MAX', 'MIN', 'STDDEV', 'MEDIAN', 'VARIANCE', 'SUM'],
        params: [
            {
                id: 'op', label: 'Statistic', type: 'select', options: [
                    { label: 'Mean (average)', value: 'Mean', category: 'Central Tendency', aliases: ['avg', 'mean'] },
                    { label: 'Median', value: 'Median', category: 'Central Tendency', aliases: ['median'] },
                    { label: 'Sum', value: 'Sum', category: 'Central Tendency', aliases: ['total', 'sum'] },
                    { label: 'Maximum', value: 'Max', category: 'Extreme Values', aliases: ['max', 'highest'] },
                    { label: 'Minimum', value: 'Min', category: 'Extreme Values', aliases: ['min', 'lowest'] },
                    { label: 'Std Deviation', value: 'StdDev', category: 'Dispersion', aliases: ['stddev', 'sigma'] },
                    { label: 'Variance', value: 'Variance', category: 'Dispersion', aliases: ['var'] }
                ]
            }
        ]
    },

    // ─── 7. Logic & Flow ───────────────────────────────────────────
    {
        id: 'LG-01',
        label: 'Logic Gate',
        category: 'Logic & Flow',
        handles: [
            { id: 'in_a', type: 'target', variant: 'single', dataType: 'any', label: 'A' },
            { id: 'in_b', type: 'target', variant: 'single', dataType: 'any', label: 'B' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'boolean' }
        ],
        defaultData: { op: 'AND', label: 'AND' },
        params: [
            {
                id: 'op', label: 'Gate Type', type: 'select', options: [
                    { label: 'AND (&&)', value: 'AND', category: 'Boolean Gates', aliases: ['and', 'gate'] },
                    { label: 'OR (||)', value: 'OR', category: 'Boolean Gates', aliases: ['or', 'gate'] },
                    { label: 'NOT (!)', value: 'NOT', category: 'Boolean Gates', aliases: ['not', 'gate', 'inv'] },
                    { label: 'XOR (⊕)', value: 'XOR', category: 'Boolean Gates', aliases: ['xor', 'gate'] },
                    { label: 'Equal (==)', value: 'EQ', category: 'Comparisons', aliases: ['eq', 'equal'] },
                    { label: 'Not Equal (!=)', value: 'NEQ', category: 'Comparisons', aliases: ['neq', 'not equal'] },
                    { label: 'Greater Than (>)', value: 'GT', category: 'Comparisons', aliases: ['gt', 'greater'] },
                    { label: 'Less Than (<)', value: 'LT', category: 'Comparisons', aliases: ['lt', 'less'] },
                    { label: 'Greater or Equal (>=)', value: 'GTE', category: 'Comparisons', aliases: ['gte'] },
                    { label: 'Less or Equal (<=)', value: 'LTE', category: 'Comparisons', aliases: ['lte'] }
                ]
            }
        ]
    },
    {
        id: 'LG-02',
        label: 'Logic Switch',
        category: 'Logic & Flow',
        handles: [
            { id: 'condition', type: 'target', variant: 'single', dataType: 'boolean', label: 'Select' },
            { id: 'in_true', type: 'target', variant: 'single', dataType: 'any', label: 'True' },
            { id: 'in_false', type: 'target', variant: 'single', dataType: 'any', label: 'False' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'any' }
        ],
        defaultData: { type: 'switch' }
    },
    {
        id: 'LG-03',
        label: 'Logic Split',
        category: 'Logic & Flow',
        handles: [
            { id: 'condition', type: 'target', variant: 'single', dataType: 'boolean', label: 'If' },
            { id: 'data', type: 'target', variant: 'single', dataType: 'any', label: 'Data' },
            { id: 'out_true', type: 'source', variant: 'single', dataType: 'any', label: 'True' },
            { id: 'out_false', type: 'source', variant: 'single', dataType: 'any', label: 'False' }
        ],
        defaultData: { type: 'logicSplit' }
    },

    // ─── 8. Output Family ──────────────────────────────────────────
    {
        id: 'OT-01',
        label: 'Result',
        category: 'Output',
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'any' }
        ],
        defaultData: { type: 'result', viewMode: 'auto' },
        params: [
            {
                id: 'viewMode', label: 'Display Mode', type: 'select', options: [
                    { label: 'Auto', value: 'auto' },
                    { label: 'Text', value: 'text' },
                    { label: 'Grid / Matrix', value: 'grid' },
                    { label: 'Color', value: 'color' },
                    { label: 'Formula', value: 'formula' },
                    { label: 'LaTeX', value: 'latex' }
                ]
            },
            {
                id: 'precision', label: 'Precision', type: 'select', options: [
                    { label: 'Auto', value: -1 },
                    { label: '0 d.p.', value: 0 },
                    { label: '1 d.p.', value: 1 },
                    { label: '2 d.p.', value: 2 },
                    { label: '3 d.p.', value: 3 },
                    { label: '4 d.p.', value: 4 },
                    { label: '5 d.p.', value: 5 },
                    { label: '6 d.p.', value: 6 },
                    { label: '8 d.p.', value: 8 },
                    { label: '10 d.p.', value: 10 }
                ]
            }
        ]
    },
    {
        id: 'OT-02',
        label: 'Status',
        category: 'Output',
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'boolean' }
        ],
        defaultData: { state: 'void' }
    },
    {
        id: 'OT-03',
        label: 'Graph Plot',
        category: 'Output',
        handles: [
            { id: 'in', type: 'target', variant: 'capsule', dataType: 'any' }
        ],
        defaultData: { minX: -10, maxX: 10, points: 100 },
        aliases: ['plot', 'graph', 'chart', 'visualization'],
        params: [
            { id: 'minX', label: 'Min X', type: 'number' },
            { id: 'maxX', label: 'Max X', type: 'number' },
            { id: 'points', label: 'Sampling Points', type: 'number', min: 10, max: 2000, step: 10, hint: 'Higher = smoother, more CPU' }
        ]
    },
    {
        id: 'OT-04',
        label: 'Debug',
        category: 'Output',
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: '' }
        ],
        defaultData: { type: 'debug' }
    },

    // ─── 9. Utility Family ─────────────────────────────────────────
    {
        id: 'UT-01',
        label: 'Sticky Note',
        category: 'Utility',
        handles: [],
        defaultData: {
            markdown: '# New Note\nDouble click to edit.',
            width: 200,
            height: 150
        },
        aliases: ['annotation', 'note', 'text', 'markdown'],
        minWidth: 150,
        minHeight: 100,
        layoutMetadata: {
            uiOrigin: [0, 0],
            physicalAnchor: [0, 0]
        },
        params: [
            { id: 'markdown', label: 'Content', type: 'textarea', hint: 'Supports Markdown & GFM alerts' },
            {
                id: 'bgColor', label: 'Background', type: 'select', options: [
                    { label: 'Dark (default)', value: 'default', category: 'Presets' },
                    { label: 'Amber / Warning', value: 'amber', category: 'Presets' },
                    { label: 'Blue / Info', value: 'blue', category: 'Presets' },
                    { label: 'Green / Success', value: 'green', category: 'Presets' },
                    { label: 'Red / Error', value: 'red', category: 'Presets' },
                    { label: 'Purple / Special', value: 'purple', category: 'Presets' }
                ]
            },
            {
                id: 'textSize', label: 'Font Size', type: 'select', options: [
                    { label: 'Small', value: 'sm', category: 'Typography' },
                    { label: 'Medium (default)', value: 'md', category: 'Typography' },
                    { label: 'Large', value: 'lg', category: 'Typography' }
                ]
            }
        ]
    },
    {
        id: 'UT-02',
        label: 'Reroute',
        category: 'Utility',
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: '' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'any', label: '' }
        ],
        defaultData: { type: 'reroute' },
        draggable: false
    }
];

// Helper: Get definitions grouped by category (for menu rendering)
export function getDefinitionsByCategory(): { category: string; items: NodeDefinition[] }[] {
    const map = new Map<string, NodeDefinition[]>();
    for (const def of NODE_DEFINITIONS) {
        if (!map.has(def.category)) map.set(def.category, []);
        map.get(def.category)!.push(def);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}
