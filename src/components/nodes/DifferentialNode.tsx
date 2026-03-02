
import { memo, useMemo, useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

export const DifferentialNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const { updateNodeData } = useReactFlow();




    const variable = (data.variable as string) || 'x';
    const order = Number(data.order) || 1;

    // Auto-detect variables (placeholder for future implementation)
    const detectedVars = useMemo((): CategorizedMenuItem[] => {
        return [
            { id: 'x', label: 'x', category: 'Variables' },
            { id: 'y', label: 'y', category: 'Variables' },
            { id: 'z', label: 'z', category: 'Variables' },
            { id: 't', label: 't', category: 'Time' },
        ];
    }, []);

    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        updateNodeData(id, { variable: item.id });
        closeMenu();
    }, [id, updateNodeData]);


    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[120px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Derivative
                </div>

                <div className="w-full flex flex-col gap-1.5">
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8">d/d</span>
                        <button
                            className="nodrag flex-1 bg-zinc-900 border border-zinc-700/50 rounded px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group"
                            onClick={handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="font-mono">{variable}</span>
                            <svg className="w-2.5 h-2.5 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8">Ord</span>
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={order}
                            onChange={(e) => updateNodeData(id, { order: Math.max(1, Math.min(5, Number(e.target.value))) })}
                            className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-12 text-center focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                    </div>
                </div>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={detectedVars}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleSelect}
                    placeholder="Search Var..."
                    width="24"
                />
            </div>
        </BaseNode>
    );
});

DifferentialNode.displayName = 'DifferentialNode';
