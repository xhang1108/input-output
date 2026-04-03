/**
 * GeometryUtils.ts
 * 
 * Central utility for normalizing coordinates and handling structural
 * bounds between React Flow's rendering space and the Engine's mathematical space.
 */

import { Position } from '@xyflow/react';
import { DEFAULT_UI_ORIGIN, DEFAULT_PHYSICAL_ANCHOR } from '../types/nodeDefinitions';

export interface BBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const FALLBACK_SIZE = { width: 150, height: 100 };

export class GeometryUtils {
    /**
     * migratePosition
     * 
     * Core migration formula to translate coordinates between different UI origins.
     * Used for backward compatibility (e.g. migrating Center-based saves to TopLeft-based).
     * 
     * Formula:
     * TopLeft_X = Center_X - (Width / 2)
     * TopLeft_Y = Center_Y - (Height / 2)
     * 
     * @param pos The current position
     * @param measured Optional measured size of the node
     * @param fromOrigin Original origin [x, y] (default [0.5, 0.5])
     * @param toOrigin Target origin [x, y] (default [0, 0])
     */
    static migratePosition(
        pos: { x: number; y: number },
        measured?: { width?: number; height?: number },
        fromOrigin: [number, number] = [0.5, 0.5],
        toOrigin: [number, number] = [0, 0]
    ) {
        // 1. Get dimensions, fallback to constants if measured is missing
        const w = measured?.width ?? FALLBACK_SIZE.width;
        const h = measured?.height ?? FALLBACK_SIZE.height;

        // 2. Calculate origin delta
        // If from [0.5, 0.5] to [0, 0], delta is (0 - 0.5) * size = -0.5 * size
        const dx = (toOrigin[0] - fromOrigin[0]) * w;
        const dy = (toOrigin[1] - fromOrigin[1]) * h;

        return {
            x: pos.x + dx,
            y: pos.y + dy
        };
    }

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
        _width: number | undefined,
        _height: number | undefined,
        uiOrigin: [number, number] = DEFAULT_UI_ORIGIN,
        physicalAnchor: [number, number] = DEFAULT_PHYSICAL_ANCHOR
    ): { x: number; y: number } {
        // Since both uiOrigin and physicalAnchor default to [0, 0], 
        // the Physical Center IS the Render Position.
        // We only apply offsets if they are explicitly different from top-left.
        const w = _width ?? 0;
        const h = _height ?? 0;

        const absoluteTopLeftX = renderX - w * uiOrigin[0];
        const absoluteTopLeftY = renderY - h * uiOrigin[1];

        const physicalX = absoluteTopLeftX + w * physicalAnchor[0];
        const physicalY = absoluteTopLeftY + h * physicalAnchor[1];

        return { x: physicalX, y: physicalY };
    }
}

