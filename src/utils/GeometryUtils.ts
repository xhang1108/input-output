/**
 * GeometryUtils.ts
 * 
 * Central utility for normalizing coordinates and handling structural
 * bounds between React Flow's rendering space and the Engine's mathematical space.
 */

import { Position } from '@xyflow/react';
import { DEFAULT_UI_ORIGIN, DEFAULT_PHYSICAL_ANCHOR } from '../types/NodeDefinition';

export interface BBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class GeometryUtils {
    /**
     * computePhysicalCenter
     * 
     * Converts a node's stored position (which is based on React Flow's uiOrigin rendering)
     * into the absolute Physical Center of Mass `[0.5, 0.5]`.
     * 
     * This ensures that algorithms in the Engine (e.g. Layout, Collisions, Frames)
     * can calculate accurately regardless of how the UI decides to render it.
     * 
     * @param renderX The x coordinate from node.position
     * @param renderY The y coordinate from node.position
     * @param width The measured width of the node
     * @param height The measured height of the node
     * @param uiOrigin The origin logic used by the UI [x, y] (e.g., [0,0] or [0.5,0.5])
     * @param physicalAnchor The intended mathematical anchor in the engine (default [0.5, 0.5] for center of mass)
     * @returns A consistent absolute coordinate for the physicalAnchor (usually the center)
     */
    static computePhysicalCenter(
        renderX: number,
        renderY: number,
        width: number | undefined,
        height: number | undefined,
        uiOrigin: [number, number] = DEFAULT_UI_ORIGIN,
        physicalAnchor: [number, number] = DEFAULT_PHYSICAL_ANCHOR
    ): { x: number; y: number } {
        // Fallback dimensions for unmeasured nodes to avoid NaN
        const w = width ?? 100;
        const h = height ?? 50;

        // 1. First, find the absolute Top-Left coordinate (0,0) of the BBox
        // If uiOrigin is [0.5, 0.5], renderX is the center. So TopLeftX = renderX - width * 0.5.
        const absoluteTopLeftX = renderX - w * uiOrigin[0];
        const absoluteTopLeftY = renderY - h * uiOrigin[1];

        // 2. Add the physical anchor offset to calculate the mathematical coordinate
        // If physicalAnchor is [0.5, 0.5], we go from TopLeft to the Center.
        const physicalX = absoluteTopLeftX + w * physicalAnchor[0];
        const physicalY = absoluteTopLeftY + h * physicalAnchor[1];

        return { x: physicalX, y: physicalY };
    }
}
