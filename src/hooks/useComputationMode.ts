
import { useState, useEffect } from 'react';
import { Brain } from '../engine/Brain';
import { ComputationMode } from '../engine/types';

/**
 * useComputationMode
 * React hook to sync with Brain's computation mode.
 * 
 * NOTE: Since Brain is a Singleton without an EventBus (yet), 
 * we need a way to subscribe.
 * ideally, Brain should extend EventTarget or have a subscribe method.
 * For now, we will add a simple listener to Brain.
 */

// We need to patch Brain to allow subscriptions effectively.
// But let's check Brain.ts first. It doesn't have listeners.
// So we will add a simple polling or better, add subscribe to Brain.

export function useComputationMode() {
    const [mode, setMode] = useState<ComputationMode>(Brain.getInstance().getMode());

    useEffect(() => {
        const brain = Brain.getInstance();

        const cleanup = brain.on('modeChanged', (newMode: ComputationMode) => {
            setMode(newMode);
        });

        return () => {
            cleanup();
        };
    }, []);

    const toggleMode = () => {
        const current = Brain.getInstance().getMode();
        const next = current === 'scientific' ? 'engineering' : 'scientific';
        Brain.getInstance().applyTransaction({
            type: 'SET_MODE',
            payload: next
        });
    };

    return { mode, toggleMode };
}
