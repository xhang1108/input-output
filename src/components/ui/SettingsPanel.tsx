import { Settings, Check, Grid, Magnet, Bug, PanelRight, Mouse, Upload, Download, FolderOpen, Layout } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Panel } from '@xyflow/react';
import { LayoutAlgorithm, LayoutDirection } from '../../hooks/layoutEngine';
import { AuthButton } from './AuthButton';

interface SettingsPanelProps {
    isSnapping: boolean;
    setSnapping: (enabled: boolean) => void;
    showDebug: boolean;
    setShowDebug: (visible: boolean) => void;
    edgeType: string;
    setEdgeType: (type: string) => void;
    layoutAlgorithm: LayoutAlgorithm;
    setLayoutAlgorithm: (type: LayoutAlgorithm) => void;
    panOnScroll: boolean;
    setPanOnScroll: (enabled: boolean) => void;
    onReset: () => void;
    onBackToProjects: () => void;
}

import { useAppStore } from '../../store/useStore';
import { SUPPORTED_PRECISIONS } from '../../engine/mathConfig';

import { GraphImportModal } from './GraphImportModal';
import { GraphExportModal } from './GraphExportModal';

export function SettingsPanel({
    isSnapping, setSnapping,
    showDebug, setShowDebug,
    edgeType, setEdgeType,
    layoutAlgorithm, setLayoutAlgorithm,
    panOnScroll, setPanOnScroll,
    onReset,
    onBackToProjects
}: SettingsPanelProps) {
    const { mathPrecision, setMathPrecision, menuLayout, setMenuLayout } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <Panel position="top-right" className="flex flex-col items-end gap-2">
            <div ref={panelRef} className="flex flex-col items-end gap-2">
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    p-2 rounded-lg border shadow-lg transition-all duration-200
                    ${isOpen ? 'bg-surface-light border-border-dim text-zinc-100' : 'bg-surface-base/80 border-surface-light text-zinc-400 hover:text-zinc-200 hover:bg-surface-light'}
                `}
                title="Settings"
            >
                <Settings className={`w-5 h-5 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Menu Panel */}
            {isOpen && (
                <div className="bg-surface-base border border-border-dim rounded-xl shadow-2xl p-2 w-48 flex flex-col gap-1 animate-in slide-in-from-top-2 fade-in duration-200">

                    {/* User Authentication */}
                    <AuthButton />

                    <Divider />

                    {/* Snapping */}
                    <ToggleRow
                        label="Grid Snapping"
                        icon={<Magnet className="w-4 h-4" />}
                        active={isSnapping}
                        onClick={() => { setSnapping(!isSnapping); }}
                    />

                    <Divider />

                    {/* Edge Type Selector */}
                    <SegmentedControl
                        label="Connection Style"
                        value={edgeType}
                        onChange={setEdgeType}
                        options={[
                            { value: 'bezier', label: 'Bezier' },
                            { value: 'smoothstep', label: 'S-Step' }
                        ]}
                    />

                    <Divider />

                    {/* Layout Controls */}
                    <SegmentedControl
                        label="Auto Layout"
                        value={layoutAlgorithm}
                        onChange={setLayoutAlgorithm}
                        options={[
                            { value: 'layered', label: 'Layered' },
                            { value: 'tree', label: 'Tree' }
                        ]}
                    />

                    <Divider />

                    {/* Input Device Navigation Mode */}
                    <SegmentedControl
                        label="Input Device"
                        value={panOnScroll}
                        onChange={setPanOnScroll}
                        options={[
                            { value: true, label: 'Touchpad' },
                            { value: false, label: 'Mouse' }
                        ]}
                    />

                    <Divider />

                    {/* Precision Selector */}
                    <SegmentedControl
                        label="Scientific Precision"
                        value={mathPrecision}
                        onChange={setMathPrecision}
                        options={SUPPORTED_PRECISIONS.map(p => ({
                            value: p,
                            label: `${p}B`
                        }))}
                    />

                    <Divider />

                    {/* Menu Layout */}
                    <SegmentedControl
                        label="Menu Layout"
                        value={menuLayout}
                        onChange={setMenuLayout}
                        options={[
                            { value: 'expanded', label: 'Expanded' },
                            { value: 'horizontal', label: 'Horizontal' }
                        ]}
                    />

                    <Divider />

                    {/* Debug Log */}
                    <ToggleRow
                        label="Debug Overlay"
                        icon={<Bug className="w-4 h-4" />}
                        active={showDebug}
                        onClick={() => { setShowDebug(!showDebug); }}
                    />

                    <Divider />

                    {/* Import */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setShowImportModal(true);
                        }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-zinc-400 hover:bg-surface-light/50 hover:text-zinc-300"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-zinc-500"><Upload className="w-4 h-4" /></span>
                            Import
                        </div>
                    </button>

                    {/* Export */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            setShowExportModal(true);
                        }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-zinc-400 hover:bg-surface-light/50 hover:text-zinc-300"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-zinc-500"><Download className="w-4 h-4" /></span>
                            Export
                        </div>
                    </button>

                    {/* Dashboard (Back to Load Screen) */}
                    <button
                        onClick={() => {
                            setIsOpen(false);
                            onBackToProjects();
                        }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-zinc-400 hover:bg-surface-light/50 hover:text-zinc-300"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-zinc-500"><Layout className="w-4 h-4" /></span>
                            Dashboard
                        </div>
                    </button>

                    <Divider />

                    {/* Reset Canvas */}
                    <button
                        onClick={onReset}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-danger hover:bg-danger/10 hover:text-danger/80"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-danger/70"><Settings className="w-4 h-4" /></span>
                            Reset Canvas
                        </div>
                    </button>
                </div>
            )}
            </div>

            <GraphImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} />
            <GraphExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
        </Panel>
    );
}

function Divider() {
    return <div className="h-px bg-surface-light/40 my-1" />;
}

function SegmentedControl<T>({
    label,
    value,
    onChange,
    options
}: {
    label: string,
    value: T,
    onChange: (val: T) => void,
    options: { value: T, label: string }[]
}) {
    return (
        <div className="px-3 py-2">
            <div className="text-xs text-zinc-500 font-bold mb-2 uppercase tracking-wider">{label}</div>
            <div className="flex gap-1 overflow-hidden rounded-xl border border-border-dim p-1 bg-surface-dim">
                {options.map((opt, idx) => (
                    <button
                        key={idx}
                        onClick={() => onChange(opt.value)}
                        className={`
                            flex-1 text-[10px] py-1.5 px-2 rounded-lg transition-all capitalize
                            ${value === opt.value
                                ? 'bg-surface-light text-(--color-unit) font-bold shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-400 hover:bg-surface-base'}
                        `}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function ToggleRow({ label, icon, active, onClick }: { label: string, icon: React.ReactNode, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full
                ${active ? 'bg-surface-light text-zinc-100' : 'text-zinc-400 hover:bg-surface-light/50 hover:text-zinc-300'}
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
