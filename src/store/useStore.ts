
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LayoutAlgorithm, LayoutDirection } from '../nerves/layoutEngine';

interface AppState {
    // UI Toggles
    showPalette: boolean;
    palettePosition: { x: number; y: number };
    showInspector: boolean;

    // Settings
    manualSnap: boolean;
    showGrid: boolean;
    showDebug: boolean;
    edgeType: string;
    layoutAlgorithm: LayoutAlgorithm;
    layoutDirection: LayoutDirection;
    panOnScroll: boolean;
    saveStatus: 'IDLE' | 'SAVING' | 'SAVED';

    // State
    actionLog: string[];

    // Actions
    logAction: (action: string) => void;
    setShowPalette: (show: boolean | ((prev: boolean) => boolean)) => void;
    setPalettePosition: (pos: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
    setShowInspector: (show: boolean | ((prev: boolean) => boolean)) => void;

    setManualSnap: (snap: boolean | ((prev: boolean) => boolean)) => void;
    setShowGrid: (show: boolean | ((prev: boolean) => boolean)) => void;
    setShowDebug: (show: boolean | ((prev: boolean) => boolean)) => void;
    setEdgeType: (type: string | ((prev: string) => string)) => void;
    setLayoutAlgorithm: (algo: LayoutAlgorithm | ((prev: LayoutAlgorithm) => LayoutAlgorithm)) => void;
    setLayoutDirection: (dir: LayoutDirection | ((prev: LayoutDirection) => LayoutDirection)) => void;
    setPanOnScroll: (enabled: boolean | ((prev: boolean) => boolean)) => void;
    setSaveStatus: (status: 'IDLE' | 'SAVING' | 'SAVED') => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // Defaults
            showPalette: false,
            palettePosition: { x: 0, y: 0 },
            showInspector: false,

            manualSnap: false,
            showGrid: true,
            showDebug: true,
            edgeType: 'bezier',
            layoutAlgorithm: 'layered',
            layoutDirection: 'RIGHT',
            panOnScroll: typeof navigator !== 'undefined' ? /Mac|iPad|iPhone/.test(navigator.platform) : false,
            saveStatus: 'IDLE',
            actionLog: [],

            // Setters
            logAction: (action) => set((s) => ({ actionLog: [action, ...s.actionLog].slice(0, 20) })),
            setShowPalette: (show) => set((s) => ({ showPalette: typeof show === 'function' ? show(s.showPalette) : show })),
            setPalettePosition: (pos) => set((s) => ({ palettePosition: typeof pos === 'function' ? pos(s.palettePosition) : pos })),
            setShowInspector: (show) => set((s) => ({ showInspector: typeof show === 'function' ? show(s.showInspector) : show })),

            setManualSnap: (snap) => set((s) => ({ manualSnap: typeof snap === 'function' ? snap(s.manualSnap) : snap })),
            setShowGrid: (show) => set((s) => ({ showGrid: typeof show === 'function' ? show(s.showGrid) : show })),
            setShowDebug: (show) => set((s) => ({ showDebug: typeof show === 'function' ? show(s.showDebug) : show })),
            setEdgeType: (type) => set((s) => ({ edgeType: typeof type === 'function' ? type(s.edgeType) : type })),
            setLayoutAlgorithm: (algo) => set((s) => ({ layoutAlgorithm: typeof algo === 'function' ? algo(s.layoutAlgorithm) : algo })),
            setLayoutDirection: (dir) => set((s) => ({ layoutDirection: typeof dir === 'function' ? dir(s.layoutDirection) : dir })),
            setPanOnScroll: (enabled) => set((s) => ({ panOnScroll: typeof enabled === 'function' ? enabled(s.panOnScroll) : enabled })),
            setSaveStatus: (status) => set({ saveStatus: status }),
        }),
        {
            name: 'calctopus-settings-v2',
            partialize: (state) => ({
                manualSnap: state.manualSnap,
                showGrid: state.showGrid,
                showDebug: state.showDebug,
                edgeType: state.edgeType,
                layoutAlgorithm: state.layoutAlgorithm,
                layoutDirection: state.layoutDirection,
                panOnScroll: state.panOnScroll,
                showInspector: state.showInspector,
            }),
        }
    )
);
