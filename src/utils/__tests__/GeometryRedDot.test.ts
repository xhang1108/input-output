import { describe, it, expect } from 'vitest';
import { GeometryUtils } from '../GeometryUtils';
import { DEFAULT_UI_ORIGIN, DEFAULT_PHYSICAL_ANCHOR } from '../../types/NodeDefinition';

/**
 * GeometryRedDot.test.ts
 * "The Red-Dot Constitution"
 * 
 * This test suite ensures that the node coordinate system remains anchored to the 
 * top-left (minX, minY) origin [0, 0] and that no 'center-based' [0.5, 0.5] 
 * logic reverts back into the codebase.
 */
describe('Red-Dot Geometry Sovereignty', () => {

    it('should verify global defaults are locked to Top-Left [0, 0]', () => {
        // This is the most critical check: prevents silent reversion to [0.5, 0.5]
        expect(DEFAULT_UI_ORIGIN).toEqual([0, 0]);
        expect(DEFAULT_PHYSICAL_ANCHOR).toEqual([0, 0]);
    });

    it('should ensure Physical Center calculation is transparent in Red-Dot mode', () => {
        // Given a node at (100, 100) with dimensions (500, 300)
        // Its 'Physical Center' in the math engine should be EXACTLY (100, 100)
        // because the Anchor is [0, 0].
        const renderX = 100;
        const renderY = 100;
        const width = 500;
        const height = 300;

        const physical = GeometryUtils.computePhysicalCenter(
            renderX,
            renderY,
            width,
            height,
            DEFAULT_UI_ORIGIN,
            DEFAULT_PHYSICAL_ANCHOR
        );

        expect(physical.x).toBe(100);
        expect(physical.y).toBe(100);
    });

    it('should maintain absolute coordinate stability during node growth (Scaling)', () => {
        const x = 250;
        const y = 250;

        // Simulate a node growing from 10x10 to 1000x1000
        const posSmall = GeometryUtils.computePhysicalCenter(x, y, 10, 10);
        const posLarge = GeometryUtils.computePhysicalCenter(x, y, 1000, 1000);

        // Verification: The coordinate must NOT shift regardless of size
        expect(posSmall.x).toBe(250);
        expect(posLarge.x).toBe(250);
        expect(posSmall).toEqual(posLarge);
    });

    it('should handle unmeasured nodes (width/height undefined) gracefully', () => {
        const x = 50;
        const y = 50;

        // Even without dimensions, top-left anchoring remains valid
        const physical = GeometryUtils.computePhysicalCenter(
            x,
            y,
            undefined,
            undefined
        );

        expect(physical.x).toBe(50);
        expect(physical.y).toBe(50);
    });

    it('should correctly handle legacy or explicit offsets if provided', () => {
        // Ensure we haven't broken the ability to use offsets if ever needed
        // (e.g., for specialized nodes that explicitly request centering)
        const x = 100; // Center coordinate
        const w = 50;

        const physical = GeometryUtils.computePhysicalCenter(
            x,
            0,
            w,
            0,
            [0.5, 0.5], // Force center origin
            [0, 0]      // Keep top-left physical target
        );

        // TopLeftX = 100 - (50 * 0.5) = 75
        // PhysicalX = 75 + (50 * 0) = 75
        expect(physical.x).toBe(75);
    });
});
