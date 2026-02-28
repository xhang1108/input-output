import { Node, Edge, Position } from '@xyflow/react';
import { HandleConfig, HandleDataType } from '../types/NodeDefinition';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';

/**
 * Central constants for the handle system
 */
export const HANDLE_SLOT_SPACING = 14;
export const HANDLE_MIN_CAPSULE_HEIGHT = 24;
export const HANDLE_BASE_PADDING = 12;
export const HANDLE_RADIUS = 0; // Default visual radius of circular handles

/**
 * Logic-based detection of handle variant (single vs capsule)
 */
export function getHandleVariant(node: any, handleId: string): 'single' | 'capsule' {
    if (!node) return 'single';


    // 2. Check static handle definitions (blueprint)
    const targetDef = NODE_DEFINITIONS.find(d => d.id === (node.type || node.nodeType));
    const staticHandle = targetDef?.handles.find(h => h.id === handleId);
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
        lh.startsWith('in') ||
        lh === 'target' ||
        lh.includes('input') ||
        lh === 'condition' ||
        lh === 'select' ||
        lh === 'data' ||
        lh === 'if' ||
        lh === 'val' ||
        lh === 'index' ||
        lh === 'base' ||
        lh === 'n' ||
        lh === 'r'
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
