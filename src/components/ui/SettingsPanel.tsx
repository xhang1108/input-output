'use client';

import { Settings, Check, Grid, Magnet, Bug, PanelRight, Mouse, FileJson, Download } from 'lucide-react';
import { useState } from 'react';
import { LayoutAlgorithm, LayoutDirection } from '../../nerves/layoutEngine';

interface SettingsPanelProps {
    isSnapping: boolean;
    setSnapping: (enabled: boolean) => void;
    showGrid: boolean;
    setShowGrid: (visible: boolean) => void;
    showDebug: boolean;
    setShowDebug: (visible: boolean) => void;
    showInspector: boolean;
    setShowInspector: (visible: boolean) => void;
    edgeType: string;
    setEdgeType: (type: string) => void;
    layoutAlgorithm: LayoutAlgorithm;
    setLayoutAlgorithm: (type: LayoutAlgorithm) => void;
    layoutDirection: LayoutDirection;
    setLayoutDirection: (dir: LayoutDirection) => void;
    edgeAnimation: boolean;
    setEdgeAnimation: (enabled: boolean) => void;
    panOnScroll: boolean;
    setPanOnScroll: (enabled: boolean) => void;
    onReset: () => void;
}

import { GraphImportModal } from './GraphImportModal';
import { GraphExportModal } from './GraphExportModal';

export function SettingsPanel({
    isSnapping, setSnapping,
    showGrid, setShowGrid,
    showDebug, setShowDebug,
    showInspector, setShowInspector,
    edgeType, setEdgeType,
    layoutAlgorithm, setLayoutAlgorithm,
    layoutDirection, setLayoutDirection,
    edgeAnimation, setEdgeAnimation,
    panOnScroll, setPanOnScroll,
    onReset
}: SettingsPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);

    return (
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    p-2 rounded-lg border shadow-lg transition-all duration-200
                    ${isOpen ? 'bg-zinc-800 border-zinc-600 text-zinc-100' : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}
                `}
                title="Settings"
            >
                <Settings className={`w-5 h-5 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Menu Panel */}
            {isOpen && (
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-2 w-48 flex flex-col gap-1 animate-in slide-in-from-top-2 fade-in duration-200">

                    {/* Snapping */}
                    <ToggleRow
                        label="Grid Snapping"
                        icon={<Magnet className="w-4 h-4" />}
                        active={isSnapping}
                        onClick={() => setSnapping(!isSnapping)}
                    />

                    {/* Grid Visibility */}
                    <ToggleRow
                        label="Show Grid"
                        icon={<Grid className="w-4 h-4" />}
                        active={showGrid}
                        onClick={() => setShowGrid(!showGrid)}
                    />

                    <div className="h-px bg-zinc-800 my-1" />

                    {/* Edge Type Selector */}
                    <div className="px-3 py-2">
                        <div className="text-xs text-zinc-500 font-bold mb-2 uppercase tracking-wider">Connection Style</div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {['bezier', 'straight', 'step', 'smoothstep'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setEdgeType(type)}
                                    className={`
                                        text-xs py-1.5 px-2 rounded-md border text-center capitalize transition-colors
                                        ${edgeType === type
                                            ? 'bg-zinc-700 border-zinc-500 text-(--color-unit) font-medium'
                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}
                                    `}
                                >
                                    {type.replace('smooth', 'S-')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-zinc-800 my-1" />

                    {/* Layout Controls */}
                    <div className="px-3 py-2">
                        <div className="text-xs text-zinc-500 font-bold mb-2 uppercase tracking-wider">Auto Layout</div>

                        {/* Algorithm Selector */}
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                            {(['layered', 'force', 'tree', 'radial'] as LayoutAlgorithm[]).map(algo => (
                                <button
                                    key={algo}
                                    onClick={() => setLayoutAlgorithm(algo)}
                                    className={`
                                        text-xs py-1.5 px-2 rounded-md border text-center capitalize transition-colors
                                        ${layoutAlgorithm === algo
                                            ? 'bg-zinc-700 border-zinc-500 text-(--color-unit) font-medium'
                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}
                                    `}
                                >
                                    {algo}
                                </button>
                            ))}
                        </div>

                        {/* Direction Selector (Only for Layered and Tree) */}
                        <div className="flex gap-1">
                            {(['RIGHT', 'DOWN'] as LayoutDirection[]).map(dir => (
                                <button
                                    key={dir}
                                    onClick={() => setLayoutDirection(dir)}
                                    disabled={layoutAlgorithm === 'force' || layoutAlgorithm === 'radial'}
                                    className={`
                                        flex-1 text-[10px] py-1 px-2 rounded border text-center uppercase transition-colors
                                        ${(layoutAlgorithm === 'force' || layoutAlgorithm === 'radial')
                                            ? 'opacity-30 cursor-not-allowed bg-zinc-900 border-zinc-900 text-zinc-600'
                                            : layoutDirection === dir
                                                ? 'bg-zinc-700 border-zinc-500 text-(--color-unit)'
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}
                                    `}
                                >
                                    {dir}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-zinc-800 my-1" />

                    {/* Edge Animation */}
                    <ToggleRow
                        label="Flow Animation"
                        icon={<span className="text-(--color-scalar) font-bold">~</span>}
                        active={edgeAnimation}
                        onClick={() => setEdgeAnimation(!edgeAnimation)}
                    />

                    {/* Scroll to Pan */}
                    <ToggleRow
                        label="Scroll to Pan"
                        icon={<Mouse className="w-4 h-4" />}
                        active={panOnScroll}
                        onClick={() => setPanOnScroll(!panOnScroll)}
                    />

                    {/* Inspector */}
                    <ToggleRow
                        label="Inspector Panel"
                        icon={<PanelRight className="w-4 h-4" />}
                        active={showInspector}
                        onClick={() => setShowInspector(!showInspector)}
                    />

                    {/* Debug Log */}
                    <ToggleRow
                        label="Debug Overlay"
                        icon={<Bug className="w-4 h-4" />}
                        active={showDebug}
                        onClick={() => setShowDebug(!showDebug)}
                    />

                    <div className="h-px bg-zinc-800 my-1" />

                    {/* Import Graph */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setShowImportModal(true);
                        }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-zinc-500"><FileJson className="w-4 h-4" /></span>
                            Import Graph
                        </div>
                    </button>

                    {/* Export Graph */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setShowExportModal(true);
                        }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-zinc-500"><Download className="w-4 h-4" /></span>
                            Export Graph
                        </div>
                    </button>

                    {/* Reset Canvas */}
                    <button
                        onClick={onReset}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-red-500/70"><Settings className="w-4 h-4" /></span>
                            Reset Canvas
                        </div>
                    </button>
                </div>
            )}

            <GraphImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} />
            <GraphExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
        </div>
    );
}

function ToggleRow({ label, icon, active, onClick }: { label: string, icon: React.ReactNode, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full
                ${active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'}
            `}
        >
            <div className="flex items-center gap-3">
                <span className={active ? 'text-(--color-unit)' : 'text-zinc-500'}>{icon}</span>
                {label}
            </div>
            {active && <Check className="w-3 h-3 text-(--color-vector)" />}
        </button>
    );
}
