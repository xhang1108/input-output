import { Position } from '@xyflow/react';

// Data type determines handle color via CSS variable lookup
export type HandleDataType = 'scalar' | 'matrix' | 'vector' | 'soul' | 'unit' | 'string' | 'color' | 'boolean' | 'symbolic' | 'any';

// Handle configuration - fully describes a single connection point
export interface HandleConfig {
    id: string;
    type: 'source' | 'target';
    position?: Position;         // Optional. Default: target -> Left, source -> Right
    variant: 'single' | 'capsule';
    dataType?: HandleDataType;  // Determines color. Default: 'scalar'
    label?: string;             // Optional label shown near handle
    y?: number | string;        // Optional manual Y position (percent or absolute px)
}

/**
 * Helper to resolve the position of a handle if not explicitly provided.
 */
export function resolveHandlePosition(h: HandleConfig): Position {
    if (h.position) return h.position;
    return h.type === 'target' ? Position.Left : Position.Right;
}

// Color lookup: dataType → CSS variable
export const HANDLE_COLOR_MAP: Record<HandleDataType, string> = {
    scalar: 'var(--color-scalar)',
    matrix: 'var(--color-matrix)',
    vector: 'var(--color-vector)',
    soul: 'var(--color-soul)',
    unit: 'var(--color-unit)',
    string: 'var(--color-string)',
    color: 'var(--color-color)',
    boolean: 'var(--color-boolean)',
    symbolic: 'var(--color-soul)', // Share soul color
    any: 'var(--color-soul)', // Use soul (violet) for 'any' for now
};

export function getHandleColor(config: HandleConfig): string {
    return HANDLE_COLOR_MAP[config.dataType || 'scalar'];
}

// Node parameter configuration
export interface NodeParameter {
    id: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    options?: { label: string; value: string | number }[];
}

// Node definition - central registry entry for a node type
export interface NodeDefinition {
    id: string;              // Type ID, e.g. 'MA-01'
    label: string;           // Display name, e.g. 'Add'
    category: string;        // Menu category, e.g. 'Math'
    handles: HandleConfig[]; // All handles (inputs AND outputs)
    defaultData?: Record<string, unknown>; // Default data payload
    params?: NodeParameter[];
    opTokens?: string[];     // Used for implicit CGL operation mapping
}
