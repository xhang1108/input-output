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
    // ─── Input Family ───────────────────────────────────────────
    {
        id: 'IO-01',
        label: 'Number',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { type: 'number', value: 0 }
    },
    {
        id: 'IO-02',
        label: 'Slider',
        category: 'Input',
        handles: [
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { type: 'slider', value: 50, min: 0, max: 100, step: 1 }
    },

    // ─── Output Family ──────────────────────────────────────────
    {
        id: 'IO-11',
        label: 'Result',
        category: 'Output',
        handles: [
            { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'scalar' }
        ],
        defaultData: { type: 'result' }
    },

    // ─── Math Family ────────────────────────────────────────────
    // All share nodeType 'MA-01' but differ by `op` in defaultData
    {
        id: 'MA-01',
        label: 'Add',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'A' },
            { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'B' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'ADD', label: 'Add' }
    },
    {
        id: 'MA-01',
        label: 'Subtract',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'A' },
            { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'B' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'SUB', label: 'Sub' }
    },
    {
        id: 'MA-01',
        label: 'Multiply',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'A' },
            { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'B' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'MUL', label: 'Mul' }
    },
    {
        id: 'MA-01',
        label: 'Divide',
        category: 'Math',
        handles: [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'A' },
            { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'B' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { op: 'DIV', label: 'Div' }
    },

    // ─── Debug ──────────────────────────────────────────────────
    {
        id: 'baseNode',
        label: 'Multi-Handle (5 Inputs)',
        category: 'Debug',
        handles: [
            { id: 'in-0', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'soul', label: 'Main' },
            { id: 'in-1', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' },
            { id: 'in-2', type: 'target', position: Position.Left, variant: 'single', dataType: 'matrix' },
            { id: 'in-3', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector' },
            { id: 'in-4', type: 'target', position: Position.Left, variant: 'single', dataType: 'unit' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
        ],
        defaultData: { label: 'Dynamic Node' }
    },
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
