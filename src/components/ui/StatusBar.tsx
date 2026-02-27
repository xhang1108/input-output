
import React from 'react';
import { useAppStore } from '../../store/useStore';


type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';

interface StatusBarProps {
    mode: InteractionMode;
    nodeCount: number;
    selectionCount: number;
    transformValue?: string;
}

export function StatusBar({ mode, nodeCount, selectionCount, transformValue }: StatusBarProps) {
    const { actionLog, saveStatus, mathPrecision, lastEvalMs } = useAppStore();

    // Hints Configuration
    const hints: Record<InteractionMode, string[]> = {
        IDLE: ['LMB: Select', 'MMB: Pan', 'Shift+A: Add', 'G: Grab', 'F: Group', 'Shift+D: Duplicate'],
        GRABBING: ['X/Y: Lock Axis', 'Alt: Detach', 'Ctrl: Snap', 'Click: Confirm', 'Esc: Cancel'],
        SCALING: ['X/Y: Lock Axis', 'Ctrl: Snap', 'Click: Confirm', 'Esc: Cancel'],
        ROTATING: ['Ctrl: Snap', 'Click: Confirm', 'Esc: Cancel'],
        CUTTING: ['LMB: Draw', 'Release: Cut'],
    };

    const currentHints = hints[mode] || hints.IDLE;

    return (
        <div className="absolute bottom-0 left-0 w-full bg-zinc-950 border-t border-zinc-800 text-zinc-400 text-[10px] py-1 px-4 flex justify-between items-center select-none z-50">
            {/* Left: Hints */}
            <div className="flex gap-4">
                <span className="font-bold text-zinc-200 uppercase tracking-wider mr-2">{mode}</span>

                {/* Transform Value Display */}
                {transformValue && (
                    <span className="text-white bg-zinc-800 px-2 rounded font-mono">
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
                <span className={`transition-all duration-300 flex items-center gap-1.5 px-1.5 py-0.5 rounded ${saveStatus === 'SAVING' ? 'text-blue-400 bg-blue-400/10' :
                    saveStatus === 'SAVED' ? 'text-green-400 bg-green-400/10' :
                        'text-zinc-600'
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'SAVING' ? 'bg-blue-400 animate-pulse' :
                        saveStatus === 'SAVED' ? 'bg-green-400' :
                            'bg-zinc-700'
                        }`} />
                    <span className="text-[9px] font-medium tracking-tight">
                        {saveStatus === 'SAVING' ? 'SYNCING...' : saveStatus === 'SAVED' ? 'SAVED' : 'CLOUD SYNCED'}
                    </span>
                </span>

                <div className="w-px h-3 bg-zinc-800 mx-1" />

                <div className="flex gap-2.5 items-center mr-2">
                    <span className="text-zinc-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                        Prec: <span className="text-zinc-300 font-mono">{mathPrecision}B</span>
                    </span>
                    {lastEvalMs !== null && (
                        <span className="text-zinc-500 font-mono flex items-center gap-1">
                            <span className="text-[9px] text-zinc-600">solve:</span>
                            <span className={lastEvalMs > 50 ? 'text-orange-400' : 'text-zinc-300'}>
                                {lastEvalMs}ms
                            </span>
                        </span>
                    )}
                </div>

                <div className="w-px h-3 bg-zinc-800 mx-1" />

                <span>Nodes: {nodeCount}</span>
                {selectionCount > 0 && <span className="text-zinc-200">Selected: {selectionCount}</span>}
                <span>Ver 0.8.3</span>
            </div>
        </div>
    );
}
