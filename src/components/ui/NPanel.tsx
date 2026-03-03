'use client';

import { useStore, useReactFlow } from '@xyflow/react';
import { useState, useEffect } from 'react';
import { X, Cpu } from 'lucide-react';

export function NPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { setNodes } = useReactFlow();

    // Get single selected node
    const selectedNode = useStore(s => {
        const selected = s.nodes.filter(n => n.selected);
        return selected.length === 1 ? selected[0] : null;
    });

    // Local state for editing fields to avoid stutter
    const [label, setLabel] = useState('');
    const [posX, setPosX] = useState('0');
    const [posY, setPosY] = useState('0');

    // Sync state when selection changes (during render)
    const [prevSyncData, setPrevSyncData] = useState({
        id: selectedNode?.id,
        label: selectedNode?.data.label,
        x: selectedNode?.position.x,
        y: selectedNode?.position.y,
        minX: selectedNode?.data.minX,
        maxX: selectedNode?.data.maxX,
        points: selectedNode?.data.points
    });

    // Local state for Plot precision
    const [plotMin, setPlotMin] = useState('-10');
    const [plotMax, setPlotMax] = useState('10');
    const [plotPoints, setPlotPoints] = useState('100');

    if (selectedNode && (
        selectedNode.id !== prevSyncData.id ||
        selectedNode.data.label !== prevSyncData.label ||
        selectedNode.position.x !== prevSyncData.x ||
        selectedNode.position.y !== prevSyncData.y ||
        selectedNode.data.minX !== prevSyncData.minX ||
        selectedNode.data.maxX !== prevSyncData.maxX ||
        selectedNode.data.points !== prevSyncData.points
    )) {
        setPrevSyncData({
            id: selectedNode.id,
            label: selectedNode.data.label,
            x: selectedNode.position.x,
            y: selectedNode.position.y,
            minX: selectedNode.data.minX,
            maxX: selectedNode.data.maxX,
            points: selectedNode.data.points
        });
        setLabel((selectedNode.data.label as string) || '');
        setPosX(selectedNode.position.x.toFixed(1));
        setPosY(selectedNode.position.y.toFixed(1));
        setPlotMin(String(selectedNode.data.minX ?? -10));
        setPlotMax(String(selectedNode.data.maxX ?? 10));
        setPlotPoints(String(selectedNode.data.points ?? 100));
    }

    const handleUpdate = (updates: Partial<import('@xyflow/react').Node<Record<string, unknown>>>) => {
        if (!selectedNode) return;

        setNodes(nds => nds.map(n => {
            if (n.id === selectedNode.id) {
                return {
                    ...n,
                    ...updates,
                    data: { ...n.data, ...updates.data }
                };
            }
            return n;
        }));
    };

    const handlePosChange = (axis: 'x' | 'y', value: string) => {
        if (axis === 'x') setPosX(value);
        else setPosY(value);

        const num = parseFloat(value);
        if (!isNaN(num) && selectedNode) {
            handleUpdate({
                position: {
                    ...selectedNode.position,
                    [axis]: num
                }
            });
        }
    };

    const handleLabelChange = (val: string) => {
        setLabel(val);
        handleUpdate({ data: { label: val } });
    };

    const handlePlotParamChange = (field: 'minX' | 'maxX' | 'points', value: string) => {
        if (field === 'minX') setPlotMin(value);
        if (field === 'maxX') setPlotMax(value);
        if (field === 'points') setPlotPoints(value);

        const num = parseFloat(value);
        if (!isNaN(num) && selectedNode) {
            handleUpdate({
                data: {
                    ...selectedNode.data,
                    [field]: num
                }
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="absolute top-0 right-0 h-full w-80 bg-zinc-950 border-l border-zinc-800 z-40 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm">
                    <Cpu className="w-4 h-4" />
                    N PANEL
                </div>
                <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-sm text-zinc-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6 overflow-y-auto h-[calc(100vh-50px)]">
                {!selectedNode ? (
                    <div className="text-zinc-500 text-sm text-center py-10 italic">
                        Select a node to inspect
                    </div>
                ) : (
                    <>
                        {/* Identity */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Identity</h3>

                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400">Label</label>
                                <input
                                    value={label}
                                    onChange={e => handleLabelChange(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-sm px-2 py-1.5 text-sm text-zinc-200 focus:border-blue-500 outline-none transition-colors"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-400">ID</label>
                                <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-sm px-2 py-1.5 text-xs text-zinc-500 font-mono select-all">
                                    {selectedNode.id}
                                </div>
                            </div>
                        </div>

                        {/* Transform */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Transform</h3>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-400">X Position</label>
                                    <input
                                        type="number"
                                        value={posX}
                                        onChange={e => handlePosChange('x', e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 focus:border-blue-500 outline-none font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-400">Y Position</label>
                                    <input
                                        type="number"
                                        value={posY}
                                        onChange={e => handlePosChange('y', e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 focus:border-blue-500 outline-none font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Plot Settings (Phase 4.3 Support) */}
                        {selectedNode.type === 'IO-14' && (
                            <div className="space-y-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                                <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Plot Precision</h3>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-400 font-mono">Min X</label>
                                        <input
                                            type="number"
                                            value={plotMin}
                                            onChange={e => handlePlotParamChange('minX', e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-purple-500 outline-none font-mono transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-400 font-mono">Max X</label>
                                        <input
                                            type="number"
                                            value={plotMax}
                                            onChange={e => handlePlotParamChange('maxX', e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-purple-500 outline-none font-mono transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] text-zinc-400 font-mono uppercase">Sampling Points</label>
                                    <input
                                        type="number"
                                        step="10"
                                        value={plotPoints}
                                        onChange={e => handlePlotParamChange('points', e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-purple-500 outline-none font-mono transition-colors"
                                    />
                                    <p className="text-[8px] text-zinc-500 italic mt-1">Higher points = smoother curves, more CPU</p>
                                </div>
                            </div>
                        )}

                        {/* Data (Debug) */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                                Raw Data
                                <span className="text-[9px] bg-zinc-800 px-1 py-0.5 rounded text-zinc-400">READ ONLY</span>
                            </h3>
                            <div className="w-full bg-zinc-950 border border-zinc-800 rounded-sm p-2 text-[10px] text-zinc-400 font-mono overflow-auto max-h-40">
                                <pre>{JSON.stringify(selectedNode.data, null, 2)}</pre>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
