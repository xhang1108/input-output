"use client";

import { useEffect } from 'react';
import { useBrain } from '../context/BrainContext';
import { Brain } from '../engine/Brain';
import { toast } from 'sonner';

/**
 * useExampleListener
 * 
 * Listens for pending IOGL examples from localStorage (usually sent from the Wiki).
 * Injects the graph into the Brain if found.
 */
export function useExampleListener() {
    const brain = useBrain();
    useEffect(() => {
        const checkPendingExample = () => {
            const pendingIogl = localStorage.getItem('pending_example_iogl');
            if (pendingIogl) {
                try {
                    const graph = JSON.parse(pendingIogl);

                    // Inject the nodes into the current canvas
                    // we don't clear the existing project, just append the example.
                    brain.injectNodes(graph, false).then((diagnostics) => {
                        if (diagnostics.length > 0) {
                            console.warn("Example Injection Diagnostics:", diagnostics);
                        }
                        toast.success("Living Lab example injected successfully.");

                        // Clear the pending item
                        localStorage.removeItem('pending_example_iogl');
                    });
                } catch (e) {
                    console.error("Failed to parse pending example IOGL", e);
                    localStorage.removeItem('pending_example_iogl');
                }
            }
        };

        // Check on mount
        checkPendingExample();

        // Also listen for storage events if the canvas is already open in another tab
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'pending_example_iogl' && e.newValue) {
                checkPendingExample();
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);
}
