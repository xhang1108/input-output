/**
 * Physics & Interaction Configuration
 * 
 * Centralized source of truth for physical thresholds, grid sizes, and layout paddings.
 * This decouples interaction logic from DOM-specific hardcoded values.
 */
export const PHYSICS_CONFIG = {
    interaction: {
        /** Minimum mouse movement (px) to initiate a drag operation */
        dragThreshold: 5,
        /** Snap-to-grid increment (px) when holding Ctrl */
        snapGridSize: 20,
        /** Distance from screen edge (px) to trigger autopan */
        autoPanPadding: 100,
        /** Base speed multiplier for autopan acceleration */
        autoPanBaseSpeed: 20,
    },
    layout: {
        /** General padding around nodes for bounding box calculations */
        nodePadding: 40,
        /** Extra top padding for frames to accommodate the label */
        frameTopPadding: 40,
    }
} as const;

export type PhysicsConfig = typeof PHYSICS_CONFIG;
