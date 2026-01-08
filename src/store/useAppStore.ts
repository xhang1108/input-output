
import { create } from 'zustand';
import { clearCache } from '@/engine/Brain';

interface AppState {
    displayMode: 'value' | 'formula';
    toggleDisplayMode: () => void;
    setDisplayMode: (mode: 'value' | 'formula') => void;
    // Performance Optimization: Logical Versioning
    logicVersion: number;
    triggerLogicUpdate: () => void;
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
}));
