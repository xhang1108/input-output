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
        id: 'IO-01',
        label: 'Number',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { type: 'scalar', value: 0 }
    },
    {
        id: 'IO-02',
        label: 'Slider',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar', y: '68%' }
        ],
        defaultData: { type: 'slider', value: 50, min: 0, max: 100, step: 1 }
    },
    {
        id: 'IO-18',
        label: 'Color',
        category: 'Input',
        handles: [
            { id: 'hex', type: 'source', variant: 'single', dataType: 'string', label: 'HEX' },
            { id: 'rgb', type: 'source', variant: 'single', dataType: 'vector', label: 'RGB' },
            { id: 'vec3', type: 'source', variant: 'single', dataType: 'vector', label: 'Vec3' }
        ],
        defaultData: { type: 'color', value: '#3b82f6' }
    },
    {
        id: 'IO-04',
        label: 'String',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'string' }
        ],
        defaultData: { type: 'string', value: 'Hello' }
    },
    {
        id: 'MA-09', // Button (Moved from Logic)
        label: 'Button',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'boolean' }
        ],
        defaultData: { type: 'button', value: false, mode: 'sticky' }
    },
    {
        id: 'MA-03',
        label: 'Constant',
        category: 'Input', // Was Math
        handles: [
            { id: 'val', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', y: '72%' }
        ],
        defaultData: { val: 'pi', label: 'Constant' }
    },
    {
        id: 'IO-08',
        label: 'Matrix Input',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'matrix' }
        ],
        defaultData: { rawExpression: '[[0,0,0],[0,0,0],[0,0,0]]' }
    },
    {
        id: 'IO-21',
        label: 'Abacus',
        category: 'Input',
        handles: [
            { id: 'val', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { type: 'abacus', digits: [0, 0, 0, 0, 0, 0, 0] }
    },
    {
        id: 'SY-05',
        label: 'Node Expression',
        category: 'Input', // Was Expert
        handles: [
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { type: 'expression', code: '1 + 2' }
    },

    // ─── 2. Generators ──────────────────────────────────────────
    {
        id: 'IO-06',
        label: 'Random',
        category: 'Input.Generators',
        aliases: ['rand', 'noise', 'white'],
        handles: [
            { id: 'val', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: {
            type: 'random',
            mode: 'float',
            itemMode: 'float',
            min: 0,
            max: 1,
            rows: 3,
            cols: 3,
            seed: Date.now()
        }
    },
    {
        id: 'DA-05',
        label: 'Distributions',
        category: 'Input.Generators',
        aliases: ['gaussian', 'normal', 'uniform', 'probability'],
        handles: [
            { id: 'param_n', type: 'target', variant: 'single', dataType: 'scalar', label: 'N' },
            { id: 'param_1', type: 'target', variant: 'single', dataType: 'scalar', label: 'P1' },
            { id: 'param_2', type: 'target', variant: 'single', dataType: 'scalar', label: 'P2' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'matrix' }
        ],
        defaultData: { mode: 'Normal', n: 100, p1: 0, p2: 1 },
        opTokens: ['NORMAL', 'UNIFORM', 'POISSON']
    },

    // ─── 3. Math ───────────────────────────────────────────
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
        aliases: ['add', 'sub', 'mul', 'div', '+', '-', '*', '/']
    },
    {
        id: 'MA-18',
        label: 'Advanced Math',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', variant: 'single', dataType: 'scalar', label: 'Input' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'POW', label: 'Power' },
        aliases: ['pow', 'sqrt', 'abs', '^', 'root']
    },
    {
        id: 'MA-16',
        label: 'Logarithm',
        category: 'Math',
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'x' },
            { id: 'base', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Base' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'LN' },
        aliases: ['ln', 'log10', 'log2', 'log']
    },
    {
        id: 'MA-17',
        label: 'Trigonometry',
        category: 'Math', // Moved from Convert/Utility
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Angle' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'SIN' },
        aliases: ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'trig']
    },
    {
        id: 'MA-14',
        label: 'Round',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Input' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { precision: 0 },
        aliases: ['ceil', 'floor', 'trunc']
    },
    {
        id: 'MA-12',
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
        id: 'MA-02',
        label: 'Number Theory',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'A' },
            { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'B' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'GCD' },
        aliases: ['gcd', 'lcm', 'mod', 'prime', 'modulo']
    },
    {
        id: 'AD-03',
        label: 'Combinatorics',
        category: 'Math', // Was LinearAlgebra
        handles: [
            { id: 'n', type: 'target', variant: 'single', dataType: 'scalar', label: 'n' },
            { id: 'r', type: 'target', variant: 'single', dataType: 'scalar', label: 'r' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'nCr' },
        opTokens: ['NCR', 'NPR']
    },

    // ─── 4. Calculus ───────────────────────────────────────────
    {
        id: 'AD-04',
        label: 'Derivative',
        category: 'Calculus',
        handles: [
            { id: 'expr', type: 'target', variant: 'single', dataType: 'symbolic', label: 'f(x)' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'symbolic' }
        ],
        defaultData: { variable: 'x', order: 1 },
        aliases: ['d/dx', 'grad', 'nabla', 'curl', 'div', 'diff', 'derivative']
    },
    {
        id: 'AD-05',
        label: 'Integral',
        category: 'Calculus',
        handles: [
            { id: 'expr', type: 'target', variant: 'single', dataType: 'symbolic', label: 'f(x)' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { variable: 'x', mode: 'indefinite', lower: '', upper: '' },
        aliases: ['int', 'integrate', 'integral']
    },
    {
        id: 'AD-11',
        label: 'Limit',
        category: 'Calculus',
        handles: [
            { id: 'expr', type: 'target', variant: 'single', dataType: 'symbolic', label: 'f(x)' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { variable: 'x', approach: '0', direction: 'both' },
        aliases: ['lim', 'limit']
    },
    {
        id: 'AD-06',
        label: 'Solver',
        category: 'Calculus', // Was LinearAlgebra
        handles: [
            { id: 'in', type: 'target', variant: 'capsule', dataType: 'any', label: 'Eq' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'symbolic' }
        ],
        defaultData: { op: 'SOLVE' },
        aliases: ['eqn', 'solve', 'equation', 'nerdamer']
    },
    {
        id: 'SY-04',
        label: 'ODE Solver',
        category: 'Calculus',
        handles: [
            { id: 'expr', type: 'target', variant: 'single', dataType: 'symbolic', label: "f(t,y)" },
            { id: 'out', type: 'source', variant: 'single', dataType: 'matrix' }
        ],
        defaultData: { method: 'RK4', t0: 0, tEnd: 10, y0: 1, stepSize: 0.01 },
        aliases: ['rk4', 'diffeq', 'differential equation']
    },

    // ─── 5. Data & Structures ──────────────────────────────────────────
    {
        id: 'DA-07',
        label: 'Array Builder',
        category: 'Data & Structures', // Was DataStructure
        handles: [
            { id: 'in', type: 'target', variant: 'capsule', dataType: 'any', label: 'In' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'matrix' }
        ],
        defaultData: { axis: 0 },
        opTokens: ['BUILD', 'CONCAT']
    },
    {
        id: 'DA-06',
        label: 'Array Extract',
        category: 'Data & Structures', // Was DataStructure
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'matrix' },
            { id: 'index', type: 'target', variant: 'single', dataType: 'scalar', label: 'Idx' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'any' }
        ],
        defaultData: { indexMode: '1D' },
        opTokens: ['EXTRACT', 'GET']
    },
    {
        id: 'DA-03',
        label: 'List Utility',
        category: 'Data & Structures', // Was DataAnalysis
        handles: [
            { id: 'data', type: 'target', variant: 'single', dataType: 'matrix' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'matrix' }
        ],
        defaultData: { mode: 'Sort (Asc)' },
        opTokens: ['SORT', 'REVERSE', 'UNIQUE', 'CLEAN']
    },
    {
        id: 'DA-04',
        label: 'Set Operations',
        category: 'Data & Structures', // Was DataAnalysis
        handles: [
            { id: 'a', type: 'target', variant: 'single', dataType: 'matrix', label: 'A' },
            { id: 'b', type: 'target', variant: 'single', dataType: 'matrix', label: 'B' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'matrix' }
        ],
        defaultData: { mode: 'Union' },
        opTokens: ['UNION', 'INTERSECTION', 'DIFFERENCE']
    },
    {
        id: 'AD-02',
        label: 'Vector Utils',
        category: 'Data & Structures', // Was LinearAlgebra
        handles: [
            { id: 'in_a', type: 'target', variant: 'single', dataType: 'vector', label: 'A' },
            { id: 'in_b', type: 'target', variant: 'single', dataType: 'vector', label: 'B' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'DOT' },
        opTokens: ['DOT', 'CROSS'],
        aliases: ['dot', 'cross', 'norm', 'distance', 'dist']
    },
    {
        id: 'AD-09',
        label: 'Vector Split',
        category: 'Data & Structures', // Was LinearAlgebra
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'vector' },
            { id: 'x', type: 'source', variant: 'single', dataType: 'scalar', label: 'X' },
            { id: 'y', type: 'source', variant: 'single', dataType: 'scalar', label: 'Y' },
            { id: 'z', type: 'source', variant: 'single', dataType: 'scalar', label: 'Z' }
        ],
        defaultData: { mode: 'separate' },
        opTokens: ['SEPARATE', 'COMBINE'],
        aliases: ['separate', 'combine', 'split']
    },
    {
        id: 'AD-01',
        label: 'Matrix Tools',
        category: 'Data & Structures', // Was LinearAlgebra
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'matrix' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'matrix' }
        ],
        defaultData: { op: 'INV' },
        opTokens: ['DET', 'INV', 'TRANSPOSE', 'TRACE', 'QR', 'LU', 'LUP', 'EIGEN'],
        aliases: ['inv', 'det', 'transpose', 'trace', 'qr', 'lu', 'lup', 'eigen', 'svd']
    },

    // ─── 6. Transform ──────────────────────────────────────────
    {
        id: 'IO-05',
        label: 'Unit',
        category: 'Transform', // Was Input
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'scalar' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { type: 'unit', unit: 'm' }
    },
    {
        id: 'MA-15',
        label: 'Base Converter',
        category: 'Transform', // Was Math
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'any' }
        ],
        defaultData: { base: 'HEX' }
    },
    {
        id: 'AD-10',
        label: 'Geometry',
        category: 'Transform', // Was LinearAlgebra
        handles: [
            { id: 'in_a', type: 'target', variant: 'single', dataType: 'scalar', label: 'Radius' },
            { id: 'area', type: 'source', variant: 'single', dataType: 'scalar', label: 'Area' },
            { id: 'perimeter', type: 'source', variant: 'single', dataType: 'scalar', label: 'Perim' }
        ],
        defaultData: { shape: 'Circle' },
        opTokens: ['CIRCLE', 'QUAD', 'TRIANGLE']
    },
    {
        id: 'AD-08',
        label: 'Vector Field',
        category: 'Transform', // Was LinearAlgebra
        handles: [
            { id: 'in_f', type: 'target', variant: 'single', dataType: 'symbolic', label: 'f' },
            { id: 'out_field', type: 'source', variant: 'single', dataType: 'matrix', label: 'Arrows' },
            { id: 'out_grad', type: 'source', variant: 'single', dataType: 'vector', label: 'Grad' }
        ],
        defaultData: { mode: 'gradient', var1: 'x', var2: 'y', min: -5, max: 5, density: 10 },
        aliases: ['grad', 'gradient', 'vector field']
    },
    {
        id: 'DA-02',
        label: 'Smoothing',
        category: 'Transform', // Was DataAnalysis
        handles: [
            { id: 'data', type: 'target', variant: 'single', dataType: 'matrix' },
            { id: 'window', type: 'target', variant: 'single', dataType: 'scalar', label: 'Win' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'matrix' }
        ],
        defaultData: { windowMode: 3 }
    },
    {
        id: 'DA-01',
        label: 'Statistics',
        category: 'Transform', // Was DataAnalysis (Statistics can be seen as data transformation)
        handles: [
            { id: 'data', type: 'target', variant: 'single', dataType: 'matrix' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'Mean' },
        opTokens: ['MEAN', 'MAX', 'MIN', 'STDDEV', 'MEDIAN', 'VARIANCE', 'SUM']
    },

    // ─── 7. Logic & Flow ───────────────────────────────────────────
    {
        id: 'MA-05',
        label: 'Logic Gate',
        category: 'Logic & Flow', // Was Logic
        handles: [
            { id: 'in_a', type: 'target', variant: 'single', dataType: 'any', label: 'A' },
            { id: 'in_b', type: 'target', variant: 'single', dataType: 'any', label: 'B' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'boolean' }
        ],
        defaultData: { op: 'AND', label: 'AND' }
    },
    {
        id: 'MA-04',
        label: 'Logic Switch', // Was Switch
        category: 'Logic & Flow', // Was Logic
        handles: [
            { id: 'condition', type: 'target', variant: 'single', dataType: 'boolean', label: 'Select' },
            { id: 'in_true', type: 'target', variant: 'single', dataType: 'any', label: 'True' },
            { id: 'in_false', type: 'target', variant: 'single', dataType: 'any', label: 'False' },
            { id: 'out', type: 'source', variant: 'single', dataType: 'any' }
        ],
        defaultData: { type: 'switch' }
    },
    {
        id: 'MA-13',
        label: 'Logic Split',
        category: 'Logic & Flow', // Was Logic
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
        id: 'IO-11',
        label: 'Result',
        category: 'Output',
        handles: [
            { id: 'in', type: 'target', variant: 'single' }
        ],
        defaultData: { type: 'result', viewMode: 'auto' }
    },
    {
        id: 'IO-22',
        label: 'Status',
        category: 'Output',
        handles: [
            { id: 'in', type: 'target', variant: 'single', dataType: 'any' }
        ],
        defaultData: { state: 'void' }
    },
    {
        id: 'IO-14',
        label: 'Plot',
        category: 'Output',
        handles: [
            { id: 'in', type: 'target', variant: 'capsule', dataType: 'any' }
        ],
        defaultData: {}
    },
    {
        id: 'UI-99',
        label: 'Debug',
        category: 'Output',
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: '' }
        ],
        defaultData: { type: 'debug' }
    },

    // ─── 9. Utility Family ─────────────────────────────────────────
    {
        id: 'UI-01',
        label: 'Annotation',
        category: 'Utility',
        handles: [],
        defaultData: {
            markdown: '# New Note\nDouble click to edit.',
            width: 200,
            height: 150
        }
    },
    {
        id: 'UI-03',
        label: 'Reroute',
        category: 'Utility',
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: '' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'any', label: '' }
        ],
        defaultData: { type: 'reroute' }
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
