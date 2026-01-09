
import { create } from 'zustand';
import { clearCache } from '@/engine/Brain';

interface AppState {
    displayMode: 'value' | 'formula';
    toggleDisplayMode: () => void;
    setDisplayMode: (mode: 'value' | 'formula') => void;
    // Performance Optimization: Logical Versioning
    logicVersion: number;
    triggerLogicUpdate: () => void;
    settings: {
        showMinimap: boolean;
        enableAnimations: boolean;
        edgeStyle: 'bezier' | 'straight' | 'step';
        showDebugInfo: boolean;
    };
    updateSettings: (settings: Partial<AppState['settings']>) => void;
}

export const useAppStore = create<AppState>((set) => ({
    displayMode: 'value',
    toggleDisplayMode: () => set((state) => ({
        displayMode: state.displayMode === 'value' ? 'formula' : 'value'
    })),
    setDisplayMode: (mode) => set({ displayMode: mode }),
    logicVersion: 0,
    triggerLogicUpdate: () => {
        clearCache();
        set((state) => ({ logicVersion: state.logicVersion + 1 }));
    },
    // Settings
    settings: {
        showMinimap: true,
        enableAnimations: true, // Default to true, but we will respect the toggle
        edgeStyle: 'step', // Default to current look (SmoothStep)
        showDebugInfo: false,
    },
    updateSettings: (newSettings) => set((state) => {
        const updated = {
            ...state.settings,
            ...newSettings
        };
        // Force a new object reference for settings
        return { settings: updated };
    }),
}));
