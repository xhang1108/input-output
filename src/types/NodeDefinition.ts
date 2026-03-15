import { Position } from '@xyflow/react';

// Data type determines handle color via CSS variable lookup
export type HandleDataType = 'scalar' | 'array' | 'unit' | 'string' | 'color' | 'boolean' | 'symbolic' | 'any';

// Handle configuration - fully describes a single connection point
export interface HandleConfig {
    id: string;
    type: 'source' | 'target';
    position?: Position;         // Optional. Default: target -> Left, source -> Right
    variant: 'single' | 'capsule';
    dataType?: HandleDataType;  // Determines color. Default: 'scalar'
    label?: string;             // Optional label shown near handle
    y?: number | string;        // Optional manual Y position (percent or absolute px)
    dynamicColor?: (data: any) => HandleDataType; // [0.11.4] Dynamic override based on node data
    color?: string;             // [0.11.5] Explicit CSS color override (e.g. 'var(--color-any)')
    hidden?: (data: any) => boolean; // [1.3.0] Dynamic hide based on node data
}

/**
 * Helper to resolve the position of a handle if not explicitly provided.
 */

/**
 * Describes a single editable field for the N Panel.
 * The N Panel reads this schema to auto-generate UI controls.
 * `id` maps directly to a key in node.data.
 */
export interface NodeParameter {
    id: string;           // Key in node.data, e.g. 'min', 'op', 'value'
    label: string;        // Display label in N Panel
    type: 'number' | 'string' | 'boolean' | 'select' | 'color' | 'textarea';
    min?: number;         // For type='number': minimum allowed value
    max?: number;         // For type='number': maximum allowed value
    step?: number;        // For type='number': step increment
    options?: { label: string; value: string | number; category?: string; aliases?: string[] }[];  // For type='select'
    hint?: string;        // Small italic help text shown below the field
    hidden?: (data: Record<string, unknown>) => boolean; // Optional callback to hide the field based on node data
}

export const DEFAULT_UI_ORIGIN: [number, number] = [0.5, 0.5];
export const DEFAULT_PHYSICAL_ANCHOR: [number, number] = [0.5, 0.5];

// Node definition - central registry entry for a node type
export interface NodeDefinition {
    id: string;              // Type ID, e.g. 'MA-01'
    label: string;           // Display name, e.g. 'Add'
    category: string;        // Menu category, e.g. 'Math'
    handles: HandleConfig[]; // All handles (inputs AND outputs)
    defaultData?: Record<string, unknown>; // Default data payload
    params?: NodeParameter[];
    opTokens?: string[];     // Used for implicit IOGL operation mapping
    aliases?: string[];      // Quick search terms for NodePicker (e.g. 'd/dx')
    draggable?: boolean;    // Optional. If false, node cannot be dragged directly. Default: true
    layoutMetadata?: {
        uiOrigin: [number, number];       // React Flow rendering origin
        physicalAnchor: [number, number]; // Engine mathematical center
    };
    minWidth?: number;       // [0.11.3] Minimum physical width constraint
    minHeight?: number;      // [0.11.3] Minimum physical height constraint
}

