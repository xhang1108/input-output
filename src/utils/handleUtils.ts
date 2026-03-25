import { Node, Edge, Position } from '@xyflow/react';
import { DataType } from '../types/payload';
import { NodeDefinition, HandleConfig, HandleDataType } from '../types/NodeDefinition';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';

/**
 * Helper to resolve the position of a handle if not explicitly provided.
 */
export function resolveHandlePosition(h: HandleConfig): Position {
    if (h.position) return h.position;
    return h.type === 'target' ? Position.Left : Position.Right;
}

/**
 * Central constants for the handle system
 */
export const HANDLE_SLOT_SPACING = 14;
export const HANDLE_MIN_CAPSULE_HEIGHT = 28;
export const HANDLE_BASE_PADDING = 12;
export const HANDLE_RADIUS = 0; // Default visual radius of circular handles

/**
 * Logic-based detection of handle variant (single vs capsule)
 */
export function getHandleVariant(node: any, handleId: string): 'single' | 'capsule' {
    if (!node) return 'single';


    // 2. Check static handle definitions (blueprint)
    const targetDef = NODE_DEFINITIONS.find((d: NodeDefinition) => d.id === (node.type || node.nodeType));
    const staticHandle = targetDef?.handles.find((h: HandleConfig) => h.id === handleId);
    if (staticHandle?.variant) return staticHandle.variant;

    return 'single'; // Default
}

/**
 * Standard vertical offset formula for capsule slots
 */
export function calculateSlotOffsetY(index: number, total: number): number {
    if (total <= 0) return 0;
    return (index - (total - 1) / 2) * HANDLE_SLOT_SPACING;
}

/**
 * Standard height formula for capsule handles
 */
export function calculateCapsuleHeight(totalEdges: number): number {
    return Math.max(HANDLE_MIN_CAPSULE_HEIGHT, totalEdges * HANDLE_SLOT_SPACING + HANDLE_BASE_PADDING);
}

/**
 * Heuristic detector for "input-like" handles
 * Used by Brain and other systems to infer 1-to-1 connection rules
 * when explicit variant data is missing.
 */
export function isProbablyInputHandle(handleId: string | null): boolean {
    if (!handleId) return false;
    const lh = handleId.toLowerCase();
    return (
        lh === 'in' ||
        lh.startsWith('in_') ||
        lh === 'target' ||
        lh.includes('input')
    );
}

/**
 * Shared slot detection logic based on mouse Y position
 */
export function findNearestSlot(
    mouseY: number,
    handleCenterY: number,
    totalSlots: number
): number {
    let bestDist = Infinity;
    let bestIndex = 0;

    for (let i = 0; i < totalSlots; i++) {
        const slotOffsetY = calculateSlotOffsetY(i, totalSlots);
        const slotScreenY = handleCenterY + slotOffsetY;
        const dist = Math.abs(mouseY - slotScreenY);
        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
        }
    }

    return bestIndex;
}

/**
 * Maps a DataType to its corresponding CSS color token
 * Defined in globals.css (§0.1.2)
 */
export function getHandleColor(type: DataType | string): string {
    if (!type) return 'var(--color-scalar)';

    const t = String(type).trim().toLowerCase();

    // Standard Mapping (Defined in globals.css)
    if (t === 'any' || t === 'universal') return 'var(--color-any)';
    if (t === 'scalar' || t === 'number' || t === 'float') return 'var(--color-scalar)';
    if (t === 'array' || t === 'matrix' || t === 'vector') return 'var(--color-matrix)';
    if (t === 'string' || t === 'text') return 'var(--color-string)';
    if (t === 'boolean' || t === 'bool') return 'var(--color-boolean)';
    if (t === 'color') return 'var(--color-color)';
    if (t === 'symbolic' || t === 'formula' || t === 'ast' || t === 'eq' || t === 'expression') return 'var(--color-symbolic)';
    if (t === 'unit') return 'var(--color-unit)';

    // Enum Fallback
    switch (t) {
        case DataType.Scalar: return 'var(--color-scalar)';
        case DataType.Array: return 'var(--color-matrix)';
        case DataType.String: return 'var(--color-string)';
        case DataType.Boolean: return 'var(--color-boolean)';
        case DataType.Color: return 'var(--color-color)';
        case DataType.Any: return 'var(--color-any)';
        case DataType.Symbolic: return 'var(--color-symbolic)';
        case DataType.Unit: return 'var(--color-unit)';
        default: return 'var(--color-any)';
    }
}

/**
 * Checks if a color token or string represents a "Generic/Any" handle.
 */
export function isGenericColor(color: string): boolean {
    const c = color.toLowerCase();
    return c === 'var(--color-any)' || c === 'white' || c === '#ffffff' || c === 'any';
}

/**
 * Specialized version for UI components that work with HandleConfig objects.
 */
export function getHandleColorByConfig(config: HandleConfig): string {
    return config.color || getHandleColor(config.dataType || 'scalar');
}
