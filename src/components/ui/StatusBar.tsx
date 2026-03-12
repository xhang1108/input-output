import { useStore, Panel } from '@xyflow/react';
import { useAppStore } from '../../store/useStore';
import Link from 'next/link';


type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';

interface StatusBarProps {
    mode: InteractionMode;
    transformValue?: string;
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
        <div className={`w-full bg-zinc-950 border-t border-zinc-800 text-zinc-400 text-[10px] py-1 px-4 flex justify-between items-center select-none ${isStandalone ? 'fixed bottom-0 left-0 right-0 z-50' : ''}`}>
            {/* Left: Hints */}
            <div className="flex gap-4">
                <span className="font-bold text-zinc-200 uppercase tracking-wider mr-2">{mode}</span>

                {/* Transform Value Display */}
                {transformValue && (
                    <span className="text-white bg-zinc-800 px-2 rounded-sm font-mono">
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
                <span className={`transition-all duration-300 flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm ${saveStatus === 'SAVING' ? 'text-blue-400 bg-blue-400/10' :
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
                    {uiRenderMs !== null && (
                        <span className="text-zinc-500 font-mono flex items-center gap-1">
                            <span className="text-[9px] text-zinc-600 ml-1">render:</span>
                            <span className={uiRenderMs > 40 ? 'text-red-500' : uiRenderMs > 20 ? 'text-orange-400' : 'text-green-500'}>
                                {uiRenderMs}ms
                            </span>
                        </span>
                    )}
                    {isFastMode && (
                        <span className="text-amber-500 font-bold px-1.5 py-0.5 bg-amber-500/10 rounded-sm border border-amber-500/20 ml-1">
                            FAST MODE
                        </span>
                    )}
                </div>

                <div className="w-px h-3 bg-zinc-800 mx-1" />

                <Link
                    href="/wiki"
                    className="text-blue-500/80 hover:text-blue-400 font-bold tracking-widest transition-colors px-1"
                >
                    [WIKI / HELP]
                </Link>

                <div className="w-px h-3 bg-zinc-800 mx-1" />

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
