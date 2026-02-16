import { Position } from '@xyflow/react';

// Data type determines handle color via CSS variable lookup
export type HandleDataType = 'scalar' | 'matrix' | 'vector' | 'soul' | 'unit' | 'string' | 'color';

// Handle configuration - fully describes a single connection point
export interface HandleConfig {
    id: string;
    type: 'source' | 'target';
    position: Position;
    variant: 'single' | 'capsule';
    dataType?: HandleDataType;  // Determines color. Default: 'scalar'
    label?: string;             // Optional label shown near handle
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
};

export function getHandleColor(config: HandleConfig): string {
    return HANDLE_COLOR_MAP[config.dataType || 'scalar'];
}

// Node definition - central registry entry for a node type
export interface NodeDefinition {
    id: string;              // Type ID, e.g. 'MA-01'
    label: string;           // Display name, e.g. 'Add'
    category: string;        // Menu category, e.g. 'Math'
    handles: HandleConfig[]; // All handles (inputs AND outputs)
    defaultData?: Record<string, any>; // Default data payload
}
