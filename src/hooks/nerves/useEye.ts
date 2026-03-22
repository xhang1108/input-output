import { useCallback } from 'react';
import { useReactFlow, Node } from '@xyflow/react';

/**
 * useEye - The visual nerve of Input-Output.
 * 
 * Responsibilities:
 * 1. Focus Control: Deciding what to look at (Selection vs Global).
 * 2. Camera Movement: Smooth transitions (fitView encapsulation).
 * 3. Spatial Awareness: Reporting zoom levels and viewport state.
 */
export function useEye() {
    const { fitView, getZoom, setViewport } = useReactFlow();

    // Semantic Action: Focus on specific entities or the whole world
    const focusOn = useCallback((nodesOrIds: (Node | { id: string })[] = []) => {
        if (nodesOrIds.length === 0) {
            // No target? Look at everything (Global View)
            fitView({ duration: 400, padding: 0.2 });
            return 'Global View';
        }

        // Look at specific targets
        fitView({
            nodes: nodesOrIds.map(n => ({ id: n.id })),
            duration: 400,
            padding: 0.2
        });
        return 'Focus Target';
    }, [fitView]);

    // Semantic Action: Reset camera to default state
    const resetView = useCallback(() => {
        fitView({ duration: 400, padding: 0.2 });
    }, [fitView]);

    return {
        focusOn,
        resetView,
        getZoom,
        setViewport
    };
}

