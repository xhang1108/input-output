import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { Brain } from '../engine/Brain';

const BrainContext = createContext<Brain | null>(null);

/**
 * useBrain
 * 
 * Hook to resolve the engine instance for the current context.
 * Automatically falls back to the 'main' compute session if no provider is present.
 */
export const useBrain = () => {
    const brain = useContext(BrainContext);
    if (!brain) {
        // Fallback allows gradual migration and simple usage in main app
        return Brain.getComputeSession('main');
    }
    return brain;
};

interface BrainProviderProps {
    session?: string;
    children: React.ReactNode;
}

/**
 * BrainProvider
 * 
 * Injects a specific calculation session into the component tree.
 */
export const BrainProvider: React.FC<BrainProviderProps> = ({ session = 'main', children }) => {
    // Memoize instance to ensure stability across re-renders
    const brain = useMemo(() => Brain.getComputeSession(session), [session]);

    // Automatic disposal of sandbox sessions on unmount
    useEffect(() => {
        return () => {
            if (session !== 'main') {
                brain.dispose();
            }
        };
    }, [brain, session]);

    return (
        <BrainContext.Provider value={brain}>
            {children}
        </BrainContext.Provider>
    );
};
