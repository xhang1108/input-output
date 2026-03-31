'use client';

import { useStore, Panel } from '@xyflow/react';
import { useAppStore } from '../../store/useStore';


type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';

interface StatusBarProps {
    mode: InteractionMode;
    transformValue?: string;
    isDirty?: boolean;
}

interface StatusBarContentProps extends StatusBarProps {
    nodeCount: number;
    selectionCount: number;
    isStandalone?: boolean;
}

export function StatusBarContent({ mode, transformValue, nodeCount, selectionCount, isStandalone }: StatusBarContentProps) {
    const { saveStatus, mathPrecision, lastEvalMs, uiRenderMs, isFastMode } = useAppStore();

    const hints: Record<InteractionMode, string[]> = {
        IDLE: ['LMB: Select', 'MMB: Pan', 'Shift+A: Add', 'G: Grab', 'F: Group', 'Shift+D: Duplicate'],
        GRABBING: ['X/Y: Lock Axis', 'Alt: Detach', 'Ctrl: Snap', 'Click: Confirm', 'Esc: Cancel'],
        SCALING: ['X/Y: Lock Axis', 'Ctrl: Snap', 'Click: Confirm', 'Esc: Cancel'],
        ROTATING: ['Ctrl: Snap', 'Click: Confirm', 'Esc: Cancel'],
        CUTTING: ['LMB: Draw', 'Release: Cut'],
    };

    const currentHints = hints[mode] || hints.IDLE;

    const content = (
        <div className={`w-full bg-surface-dim border-t border-surface-light text-zinc-400 text-[10px] py-1 px-4 flex justify-between items-center select-none ${isStandalone ? 'fixed bottom-0 left-0 right-0 z-50' : ''}`}>
            {/* Left: Hints */}
            <div className="flex gap-4">
                <span className="font-bold text-zinc-200 uppercase tracking-wider mr-2">{mode}</span>

                {/* Transform Value Display */}
                {transformValue && (
                    <span className="text-white bg-surface-light px-2 rounded-sm font-mono">
                        {transformValue}
                    </span>
                )}

                {currentHints.map((hint, i) => (
                    <span key={i} className="flex items-center gap-1">
                        {hint}
                    </span>
                ))}
            </div>

            {/* Right: Stats */}
            <div className="flex gap-4 items-center">
                {/* Save Status Indicator */}
                <span className={`transition-all duration-300 flex items-center gap-2 px-2.5 py-1 rounded-sm border ${
                    saveStatus === 'SAVING' ? 'text-zinc-50 bg-primary/20 border-primary/40' :
                    saveStatus === 'DIRTY' ? 'text-orange-50 bg-orange-950/30 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.1)]' :
                    saveStatus === 'LOCAL_SAVED' ? 'text-success bg-success/10 border-success/20' :
                    saveStatus === 'CLOUD_SYNCED' ? 'text-blue-400 bg-blue-900/20 border-blue-800/30' :
                    saveStatus === 'PENDING_SYNC' ? 'text-warning bg-warning/10 border-warning/20' :
                    'text-zinc-400 bg-zinc-800/30 border-zinc-700/20'
                }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                        saveStatus === 'SAVING' ? 'bg-zinc-50 animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.8)]' :
                        saveStatus === 'DIRTY' ? 'bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)] animate-[pulse_1.5s_infinite]' :
                        saveStatus === 'LOCAL_SAVED' ? 'bg-success shadow-[0_0_8px_var(--color-success)]' :
                        saveStatus === 'CLOUD_SYNCED' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                        saveStatus === 'PENDING_SYNC' ? 'bg-warning shadow-[0_0_8px_var(--color-warning)]' :
                        'bg-zinc-600'
                    }`} />
                    <span className="text-[10px] font-black tracking-widest uppercase">
                        {saveStatus === 'SAVING' ? 'SYNCING...' : 
                         saveStatus === 'DIRTY' ? 'UNSAVED' :
                         saveStatus === 'LOCAL_SAVED' ? 'LOCAL SAVED' :
                         saveStatus === 'CLOUD_SYNCED' ? 'CLOUD SYNCED' : 
                         saveStatus === 'PENDING_SYNC' ? 'SYNC PENDING' :
                         'SAVED'}
                    </span>
                </span>

                <div className="w-px h-3 bg-surface-light mx-1" />

                <div className="flex gap-2.5 items-center mr-2">
                    <span className="text-zinc-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-border-dim" />
                        Prec: <span className="text-zinc-300 font-mono">{mathPrecision}B</span>
                    </span>
                    {lastEvalMs !== null && (
                        <span className="text-zinc-500 font-mono flex items-center gap-1">
                            <span className="text-[9px] text-zinc-600">solve:</span>
                            <span className={lastEvalMs > 50 ? 'text-warning' : 'text-zinc-300'}>
                                {lastEvalMs}ms
                            </span>
                        </span>
                    )}
                    {uiRenderMs !== null && (
                        <span className="text-zinc-500 font-mono flex items-center gap-1">
                            <span className="text-[9px] text-zinc-600 ml-1">render:</span>
                            <span className={uiRenderMs > 40 ? 'text-danger' : uiRenderMs > 20 ? 'text-warning' : 'text-success'}>
                                {uiRenderMs}ms
                            </span>
                        </span>
                    )}
                    {isFastMode && (
                        <span className="text-warning font-bold px-1.5 py-0.5 bg-warning/10 rounded-sm border border-warning/20 ml-1">
                            FAST MODE
                        </span>
                    )}
                </div>

                <div className="w-px h-3 bg-surface-light mx-1" />

                <span>Nodes: {nodeCount}</span>
                {selectionCount > 0 && <span className="text-zinc-200">Selected: {selectionCount}</span>}
                <span>V1.0</span>
            </div>
        </div>
    );

    if (isStandalone) return content;

    return (
        <Panel position="bottom-left" className="p-0 m-0" style={{ margin: 0, width: '100%' }}>
            {content}
        </Panel>
    );
}

export function StatusBar({ mode, transformValue }: StatusBarProps) {
    const nodeCount = useStore((s) => s.nodes.length);
    const selectionCount = useStore((s) => s.nodes.filter(n => n.selected).length);

    return (
        <StatusBarContent
            mode={mode}
            transformValue={transformValue}
            nodeCount={nodeCount}
            selectionCount={selectionCount}
        />
    );
}
