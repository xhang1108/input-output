import React, { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const RandomNode = memo((props: NodeProps) => {
    const { id, data, selected } = props;
    const { updateNodeData } = useReactFlow();

    const handleChange = (key: string, value: unknown) => {
        updateNodeData(id, { [key]: value });
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { [key]: value } }
        });
    };

    const handleRegenerate = () => {
        const trigger = Date.now();
        updateNodeData(id, { trigger });
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { trigger } }
        });
    };

    const mode = data.mode as string || 'float';

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2">
                {/* Mode Selector */}
                <select
                    className="bg-(--node-bg-header) text-xs text-foreground rounded p-1 border border-(--node-border) outline-none hover:border-(--node-border-hover) transition-colors"
                    value={mode}
                    onChange={(e) => handleChange('mode', e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <option value="float">Float (0.0 - 1.0)</option>
                    <option value="int">Integer</option>
                    <option value="matrix">Matrix</option>
                </select>

                {/* Range Inputs */}
                <div className="flex gap-2 items-center">
                    <label className="text-[10px] text-foreground font-mono opacity-60">Min</label>
                    <input
                        type="number"
                        className="w-12 bg-(--node-bg) border border-(--node-border) rounded px-1 text-xs text-foreground nodrag outline-none focus:border-blue-500/50 transition-colors"
                        value={Number.isNaN(data.min) ? 0 : (data.min as number ?? 0)}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleChange('min', Number.isNaN(val) ? 0 : val);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                    />
                    <label className="text-[10px] text-foreground font-mono opacity-60">Max</label>
                    <input
                        type="number"
                        className="w-12 bg-(--node-bg) border border-(--node-border) rounded px-1 text-xs text-foreground nodrag outline-none focus:border-blue-500/50 transition-colors"
                        value={Number.isNaN(data.max) ? 1 : (data.max as number ?? 1)}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleChange('max', Number.isNaN(val) ? 1 : val);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                    />
                </div>

                {/* Matrix Settings (Conditional) */}
                {mode === 'matrix' && (
                    <div className="flex flex-col gap-2 p-1.5 bg-(--node-bg-header) rounded border border-(--node-border) animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] text-foreground font-bold uppercase tracking-tight opacity-70">Item Type</label>
                            <select
                                className="bg-(--node-bg) text-[10px] text-foreground rounded px-1 border border-(--node-border) outline-none hover:border-(--node-border-hover)"
                                value={data.itemMode as string || 'float'}
                                onChange={(e) => handleChange('itemMode', e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                            >
                                <option value="float">Float</option>
                                <option value="int">Integer</option>
                            </select>
                        </div>
                        <div className="flex gap-2 items-center justify-between">
                            <div className="flex gap-1 items-center">
                                <label className="text-[10px] text-foreground font-mono opacity-60">R</label>
                                <input
                                    type="number"
                                    className="w-8 bg-(--node-bg) border border-(--node-border) rounded px-1 text-xs text-foreground nodrag outline-none focus:border-blue-500/50"
                                    value={Number.isNaN(data.rows) ? 3 : (data.rows as number ?? 3)}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        handleChange('rows', Number.isNaN(val) ? 3 : val);
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                />
                            </div>
                            <div className="flex gap-1 items-center">
                                <label className="text-[10px] text-foreground font-mono opacity-60">C</label>
                                <input
                                    type="number"
                                    className="w-8 bg-(--node-bg) border border-(--node-border) rounded px-1 text-xs text-foreground nodrag outline-none focus:border-blue-500/50"
                                    value={Number.isNaN(data.cols) ? 3 : (data.cols as number ?? 3)}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        handleChange('cols', Number.isNaN(val) ? 3 : val);
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Regenerate Button */}
                <button
                    className="mt-1 bg-foreground/5 hover:bg-foreground/10 active:bg-foreground/20 text-[10px] text-foreground py-1 rounded border border-foreground/10 transition-all hover:border-foreground/20 flex justify-center items-center group"
                    onClick={handleRegenerate}
                >
                    Regenerate
                </button>
            </div>
        </BaseNode>
    );
});

RandomNode.displayName = 'RandomNode';
