import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { LayoutAlgorithm, LayoutDirection } from '../nerves/layoutEngine';
import { MathPrecision } from '../engine/mathConfig';

interface AppState {
    // UI Toggles
    showPalette: boolean;
    palettePosition: { x: number; y: number };
    showNPanel: boolean;

    // Settings
    manualSnap: boolean;
    showGrid: boolean;
    showDebug: boolean;
    edgeType: string;
    layoutAlgorithm: LayoutAlgorithm;
    layoutDirection: LayoutDirection;
    panOnScroll: boolean;
    saveStatus: 'IDLE' | 'SAVING' | 'SAVED';
    mathPrecision: MathPrecision;
    lastEvalMs: number | null;
    lastImportMs: number | null;
    uiRenderMs: number | null;
    isFastMode: boolean;

    // State
    actionLog: string[];

    // Actions
    logAction: (action: string) => void;
    setShowPalette: (show: boolean | ((prev: boolean) => boolean)) => void;
    setPalettePosition: (pos: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
    setShowNPanel: (show: boolean | ((prev: boolean) => boolean)) => void;

    setManualSnap: (snap: boolean | ((prev: boolean) => boolean)) => void;
    setShowGrid: (show: boolean | ((prev: boolean) => boolean)) => void;
    setShowDebug: (show: boolean | ((prev: boolean) => boolean)) => void;
    setEdgeType: (type: string | ((prev: string) => string)) => void;
    setLayoutAlgorithm: (algo: LayoutAlgorithm | ((prev: LayoutAlgorithm) => LayoutAlgorithm)) => void;
    setLayoutDirection: (dir: LayoutDirection | ((prev: LayoutDirection) => LayoutDirection)) => void;
    setPanOnScroll: (enabled: boolean | ((prev: boolean) => boolean)) => void;
    setSaveStatus: (status: 'IDLE' | 'SAVING' | 'SAVED') => void;
    setMathPrecision: (precision: MathPrecision) => void;
    setLastEvalMs: (ms: number | null) => void;
    setLastImportMs: (ms: number | null) => void;
    setUiRenderMs: (ms: number | null) => void;
    setFastMode: (enabled: boolean | ((prev: boolean) => boolean)) => void;
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
                showDebug: true,
                edgeType: 'bezier',
                layoutAlgorithm: 'layered',
                layoutDirection: 'RIGHT',
                panOnScroll: typeof navigator !== 'undefined' ? /Mac|iPad|iPhone/.test(navigator.platform) : false,
                saveStatus: 'IDLE',
                mathPrecision: 64,
                lastEvalMs: null,
                lastImportMs: null,
                uiRenderMs: null,
                isFastMode: false,
                actionLog: [],

                // Setters
                logAction: (action) => set((s) => ({ actionLog: [action, ...s.actionLog].slice(0, 20) })),
                setShowPalette: (show) => set((s) => ({ showPalette: typeof show === 'function' ? show(s.showPalette) : show })),
                setPalettePosition: (pos) => set((s) => ({ palettePosition: typeof pos === 'function' ? pos(s.palettePosition) : pos })),
                setShowNPanel: (show) => set((s) => ({ showNPanel: typeof show === 'function' ? show(s.showNPanel) : show })),

                setManualSnap: (snap) => set((s) => ({ manualSnap: typeof snap === 'function' ? snap(s.manualSnap) : snap })),
                setShowGrid: (show) => set((s) => ({ showGrid: typeof show === 'function' ? show(s.showGrid) : show })),
                setShowDebug: (show) => set((s) => ({ showDebug: typeof show === 'function' ? show(s.showDebug) : show })),
                setEdgeType: (type) => set((s) => ({ edgeType: typeof type === 'function' ? type(s.edgeType) : type })),
                setLayoutAlgorithm: (algo) => set((s) => ({ layoutAlgorithm: typeof algo === 'function' ? algo(s.layoutAlgorithm) : algo })),
                setLayoutDirection: (dir) => set((s) => ({ layoutDirection: typeof dir === 'function' ? dir(s.layoutDirection) : dir })),
                setPanOnScroll: (enabled) => set((s) => ({ panOnScroll: typeof enabled === 'function' ? enabled(s.panOnScroll) : enabled })),
                setSaveStatus: (status) => set({ saveStatus: status }),
                setMathPrecision: (mathPrecision) => set({ mathPrecision }),
                setLastEvalMs: (lastEvalMs) => set({ lastEvalMs }),
                setLastImportMs: (lastImportMs) => set({ lastImportMs }),
                setUiRenderMs: (uiRenderMs) => set({ uiRenderMs }),
                setFastMode: (enabled) => set((s) => ({ isFastMode: typeof enabled === 'function' ? enabled(s.isFastMode) : enabled })),
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
                    showNPanel: state.showNPanel,
                    mathPrecision: state.mathPrecision,
                }),
            }
        )
    )
);
