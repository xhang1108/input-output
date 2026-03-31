import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { LayoutAlgorithm, LayoutDirection } from '../hooks/layoutEngine';
import { MathPrecision } from '../engine/mathConfig';

interface AppState {
    // UI Toggles
    showPalette: boolean;
    palettePosition: { x: number; y: number };
    showNPanel: boolean;

    // Settings
    manualSnap: boolean;
    showGrid: boolean;
    showDebugStats: boolean;
    edgeType: string;
    layoutAlgorithm: LayoutAlgorithm;
    panOnScroll: boolean;
    saveStatus: 'IDLE' | 'DIRTY' | 'SAVING' | 'LOCAL_SAVED' | 'CLOUD_SYNCED' | 'SAVED' | 'PENDING_SYNC' | 'ERROR';
    mathPrecision: MathPrecision;
    lastEvalMs: number | null;
    lastImportMs: number | null;
    uiRenderMs: number | null;
    isFastMode: boolean;
    lastAddedNodeType: string;
    menuLayout: 'expanded' | 'horizontal';

    // State
    actionLog: string[];

    // Actions
    logAction: (action: string) => void;
    setShowPalette: (show: boolean | ((prev: boolean) => boolean)) => void;
    setPalettePosition: (pos: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
    setShowNPanel: (show: boolean | ((prev: boolean) => boolean)) => void;

    setManualSnap: (snap: boolean | ((prev: boolean) => boolean)) => void;
    setShowGrid: (show: boolean | ((prev: boolean) => boolean)) => void;
    setShowDebugStats: (show: boolean | ((prev: boolean) => boolean)) => void;
    setEdgeType: (type: string | ((prev: string) => string)) => void;
    setLayoutAlgorithm: (algo: LayoutAlgorithm | ((prev: LayoutAlgorithm) => LayoutAlgorithm)) => void;
    setPanOnScroll: (enabled: boolean | ((prev: boolean) => boolean)) => void;
    setSaveStatus: (status: 'IDLE' | 'DIRTY' | 'SAVING' | 'LOCAL_SAVED' | 'CLOUD_SYNCED' | 'SAVED' | 'PENDING_SYNC' | 'ERROR') => void;
    setMathPrecision: (precision: MathPrecision) => void;
    setLastEvalMs: (ms: number | null) => void;
    setLastImportMs: (ms: number | null) => void;
    setUiRenderMs: (ms: number | null) => void;
    setFastMode: (enabled: boolean | ((prev: boolean) => boolean)) => void;
    setLastAddedNodeType: (type: string) => void;
    setMenuLayout: (layout: 'expanded' | 'horizontal') => void;
}

export const useAppStore = create<AppState>()(
    subscribeWithSelector(
        persist(
            (set) => ({
                // Defaults
                showPalette: false,
                palettePosition: { x: 0, y: 0 },
                showNPanel: false,

                manualSnap: false,
                showGrid: true,
                showDebugStats: false,
                edgeType: 'bezier',
                layoutAlgorithm: 'layered',
                panOnScroll: typeof navigator !== 'undefined' ? /Mac|iPad|iPhone/.test(navigator.platform) : false,
                saveStatus: 'IDLE',
                mathPrecision: 16,
                lastEvalMs: null,
                lastImportMs: null,
                uiRenderMs: null,
                isFastMode: false,
                lastAddedNodeType: 'add',
                menuLayout: 'expanded',
                actionLog: [],

                // Setters
                logAction: (action) => set((s) => ({ actionLog: [action, ...s.actionLog].slice(0, 20) })),
                setShowPalette: (show) => set((s) => ({ showPalette: typeof show === 'function' ? show(s.showPalette) : show })),
                setPalettePosition: (pos) => set((s) => ({ palettePosition: typeof pos === 'function' ? pos(s.palettePosition) : pos })),
                setShowNPanel: (show) => set((s) => ({ showNPanel: typeof show === 'function' ? show(s.showNPanel) : show })),

                setManualSnap: (snap) => set((s) => ({ manualSnap: typeof snap === 'function' ? snap(s.manualSnap) : snap })),
                setShowGrid: (show) => set((s) => ({ showGrid: typeof show === 'function' ? show(s.showGrid) : show })),
                setShowDebugStats: (show) => set((s) => ({ showDebugStats: typeof show === 'function' ? show(s.showDebugStats) : show })),
                setEdgeType: (type) => set((s) => ({ edgeType: typeof type === 'function' ? type(s.edgeType) : type })),
                setLayoutAlgorithm: (algo) => set((s) => ({ layoutAlgorithm: typeof algo === 'function' ? algo(s.layoutAlgorithm) : algo })),
                setPanOnScroll: (enabled) => set((s) => ({ panOnScroll: typeof enabled === 'function' ? enabled(s.panOnScroll) : enabled })),
                setSaveStatus: (status) => set({ saveStatus: status }),
                setMathPrecision: (mathPrecision) => set({ mathPrecision }),
                setLastEvalMs: (lastEvalMs) => set({ lastEvalMs }),
                setLastImportMs: (lastImportMs) => set({ lastImportMs }),
                setUiRenderMs: (uiRenderMs) => set({ uiRenderMs }),
                setFastMode: (enabled) => set((s) => ({ isFastMode: typeof enabled === 'function' ? enabled(s.isFastMode) : enabled })),
                setLastAddedNodeType: (type) => set({ lastAddedNodeType: type }),
                setMenuLayout: (menuLayout) => set({ menuLayout }),
            }),
            {
                name: 'Input-Output-settings-v3',
                partialize: (state) => ({
                    manualSnap: state.manualSnap,
                    showGrid: state.showGrid,
                    showDebugStats: state.showDebugStats,
                    edgeType: state.edgeType,
                    layoutAlgorithm: state.layoutAlgorithm,
                    panOnScroll: state.panOnScroll,
                    showNPanel: state.showNPanel,
                    mathPrecision: state.mathPrecision,
                    lastAddedNodeType: state.lastAddedNodeType,
                    menuLayout: state.menuLayout,
                }),
            }

        )
    )
);

