'use client';

import { useEffect } from 'react';
import { Brain } from '@/engine/Brain';

/**
 * VisualClock bridge component.
 * Subscribes to the engine's visualUpdate events and syncs the internal tick 
 * to a global CSS variable for perfectly synchronized animations across all nodes.
 */
export function VisualClock() {
    useEffect(() => {
        const brain = Brain.getInstance();

        const handleVisualUpdate = () => {
            // Pick a node to get the global tick (all nodes share the same synchronized tick from heartbeat)
            // Or we could expose a global tick in Brain. For now, we use the first node found.
            const nodes = Array.from(brain.getNodesMap().values());
            if (nodes.length > 0 && nodes[0].visualState) {
                const tick = nodes[0].visualState.visualTick;
                document.documentElement.style.setProperty('--visual-tick', tick.toString());
            }
        };

        brain.on('visualUpdate', handleVisualUpdate);

        return () => {
            brain.off('visualUpdate', handleVisualUpdate);
        };
    }, []);

    return null; // Side-effect only component
}
