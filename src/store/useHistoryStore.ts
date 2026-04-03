import { create } from 'zustand';
import { Transaction } from '../engine/types/types';

export type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';

export interface HistoryEntry {
    id: string; // Unique ID for debugging
    description?: string;
    forward: Transaction[]; // For Redo
    inverse: Transaction[]; // For Undo
    // UI Metadata for visual consistency
    uiMetadata?: {
        restoredNodeIndices?: Record<string, number>; // Maps nodeId to its original index
        restoredEdgeIndices?: Record<string, number>; // Maps edgeId to its original index
    };
}

interface HistoryState {
    past: HistoryEntry[];
    future: HistoryEntry[];
    isRestoring: boolean;
    interactionMode: InteractionMode;

    // Actions
    push: (entry: HistoryEntry) => void;
    clear: () => void;
    setIsRestoring: (isRestoring: boolean) => void;
    setInteractionMode: (mode: InteractionMode) => void;
    
    // Internal mutations for executor
    popPast: () => HistoryEntry | undefined;
    popFuture: () => HistoryEntry | undefined;
    pushPastSilent: (entry: HistoryEntry) => void;
    pushFutureSilent: (entry: HistoryEntry) => void;
}

const MAX_HISTORY = 100;

export const useHistoryStore = create<HistoryState>((set, get) => ({
    past: [],
    future: [],
    isRestoring: false,
    interactionMode: 'IDLE',

    push: (entry: HistoryEntry) => {
        console.log(`[Store] Pushing history entry: ${entry.description}`, entry);
        set((state) => {
            const newPast = [...state.past, entry];
            if (newPast.length > MAX_HISTORY) {
                newPast.shift();
            }
            return {
                past: newPast,
                future: [], // Reset future on new action
            };
        });
    },

    clear: () => set({ past: [], future: [], isRestoring: false, interactionMode: 'IDLE' }),
    
    setIsRestoring: (isRestoring: boolean) => set({ isRestoring }),
    setInteractionMode: (interactionMode: InteractionMode) => set({ interactionMode }),

    popPast: () => {
        const state = get();
        if (state.past.length === 0) return undefined;
        const entry = state.past[state.past.length - 1];
        set({ past: state.past.slice(0, -1) });
        return entry;
    },

    popFuture: () => {
        const state = get();
        if (state.future.length === 0) return undefined;
        const entry = state.future[state.future.length - 1];
        set({ future: state.future.slice(0, -1) });
        return entry;
    },

    pushPastSilent: (entry: HistoryEntry) => {
        set((state) => {
            const newPast = [...state.past, entry];
            if (newPast.length > MAX_HISTORY) newPast.shift();
            return { past: newPast };
        });
    },

    pushFutureSilent: (entry: HistoryEntry) => {
        set((state) => {
            const newFuture = [...state.future, entry];
            if (newFuture.length > MAX_HISTORY) newFuture.shift();
            return { future: newFuture };
        });
    }
}));

