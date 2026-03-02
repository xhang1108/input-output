
import React, { memo, useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const RANDOM_MODES: CategorizedMenuItem[] = [
    { id: 'scalar', label: 'Scalar Value', category: 'Dimensions', aliases: ['float', 'number'] },
    { id: 'vector', label: 'Vector (1D Array)', category: 'Dimensions', aliases: ['array', 'vector'] },
    { id: 'matrix', label: 'Matrix (2D Array)', category: 'Dimensions', aliases: ['matrix', 'grid'] },
];

export const RandomNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const { updateNodeData } = useReactFlow();




    const mode = data.mode as string || 'scalar';
    const isFloat = data.isFloat !== false;

    const handleChange = useCallback((key: string, value: unknown) => {
        updateNodeData(id, { [key]: value });
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { [key]: value } }
        });
    }, [id, updateNodeData]);

    const handleMenuSelect = useCallback((item: CategorizedMenuItem) => {
        handleChange('mode', item.id);
        closeMenu();
    }, [handleChange]);


    const handleRegenerate = () => {
        const trigger = Date.now();
        handleChange('trigger', trigger);
    };

    const currentModeLabel = RANDOM_MODES.find(m => m.id === mode)?.label || mode;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 min-w-[140px]">
                {/* Mode Selector */}
                <div className="flex flex-col gap-1">
                    <button
                        className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-md px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group active:scale-95"
                        onClick={handleTrigger}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <span className="truncate font-medium group-hover:text-white lowercase">{currentModeLabel}</span>
                        <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <CategorizedMenu
                        isOpen={menuOpen}
                        items={RANDOM_MODES}
                        position={menuPos}
                        trigger={trigger}
                        onClose={closeMenu}
                        onSelect={handleMenuSelect}
                        placeholder="Search Mode..."
                        width="36"
                    />
                </div>

                {/* Float Toggle */}
                <div className="flex gap-2 items-center bg-zinc-900/30 p-1.5 rounded-md border border-zinc-700/30">
                    <input
                        type="checkbox"
                        className="cursor-pointer"
                        checked={isFloat}
                        onChange={(e) => handleChange('isFloat', e.target.checked)}
                        onPointerDown={(e) => e.stopPropagation()}
                        id={`float-toggle-${id}`}
                    />
                    <label htmlFor={`float-toggle-${id}`} className="text-[10px] text-zinc-400 font-mono cursor-pointer select-none">
                        Floating Point
                    </label>
                </div>

                {/* Range Inputs */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-zinc-500 uppercase font-black px-0.5">Min</label>
                        <input
                            type="number"
                            className="bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-blue-500/50 transition-colors w-full"
                            value={Number.isNaN(data.min) ? 0 : (data.min as number ?? 0)}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleChange('min', Number.isNaN(val) ? 0 : val);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-zinc-500 uppercase font-black px-0.5">Max</label>
                        <input
                            type="number"
                            className="bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-blue-500/50 transition-colors w-full"
                            value={Number.isNaN(data.max) ? 1 : (data.max as number ?? 1)}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleChange('max', Number.isNaN(val) ? 1 : val);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>

                {/* Vector Settings */}
                {mode === 'vector' && (
                    <div className="flex flex-col gap-1 bg-zinc-900/50 p-1.5 rounded-md border border-zinc-700/50 animate-in fade-in slide-in-from-top-1">
                        <label className="text-[9px] text-zinc-500 uppercase font-black">Length</label>
                        <input
                            type="number"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-blue-500/50"
                            value={Number.isNaN(data.length) ? 3 : (data.length as number ?? 3)}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                handleChange('length', Number.isNaN(val) ? 3 : val);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            min={1}
                        />
                    </div>
                )}

                {/* Matrix Settings */}
                {mode === 'matrix' && (
                    <div className="grid grid-cols-2 gap-2 bg-zinc-900/50 p-1.5 rounded-md border border-zinc-700/50 animate-in fade-in slide-in-from-top-1">
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-500 uppercase font-black">Rows</label>
                            <input
                                type="number"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-blue-500/50"
                                value={Number.isNaN(data.rows) ? 3 : (data.rows as number ?? 3)}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    handleChange('rows', Number.isNaN(val) ? 3 : val);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                min={1}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-500 uppercase font-black">Cols</label>
                            <input
                                type="number"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-blue-500/50"
                                value={Number.isNaN(data.cols) ? 3 : (data.cols as number ?? 3)}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    handleChange('cols', Number.isNaN(val) ? 3 : val);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                min={1}
                            />
                        </div>
                    </div>
                )}

                {/* Regenerate Button */}
                <button
                    className="mt-1 bg-zinc-100/10 hover:bg-zinc-100/20 active:bg-zinc-100/5 text-[10px] text-zinc-100 py-1.5 rounded border border-white/10 transition-all font-bold uppercase tracking-wider shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    onClick={handleRegenerate}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                </button>
            </div>
        </BaseNode>
    );
});

RandomNode.displayName = 'RandomNode';
