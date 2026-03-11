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
            const tick = brain.getVisualTick();
            document.documentElement.style.setProperty('--visual-tick', tick.toString());
        };

        brain.on('visualUpdate', handleVisualUpdate);

        return () => {
            brain.off('visualUpdate', handleVisualUpdate);
        };
    }, []);

    return null; // Side-effect only component
}
