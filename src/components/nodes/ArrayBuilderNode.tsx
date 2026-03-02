
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const AXIS_ITEMS: CategorizedMenuItem[] = [
    { id: '0', label: 'Axis 0 (Rows)', category: 'Concatenation' },
    { id: '1', label: 'Axis 1 (Cols)', category: 'Concatenation' },
];

export const ArrayBuilderNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const axis = (data.axis as number) ?? 0;
    const count = (data.count as number) || 2;




    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { axis: parseInt(item.id) } }
        });
        closeMenu();
    }, [id]);


    const handles: any[] = [
        { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'any' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix' }
    ];

    const nodeData = { ...data, handles };
    const currentLabel = AXIS_ITEMS.find(i => i.id === axis.toString())?.label || `Axis ${axis}`;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <div className="flex justify-between items-center px-1 pb-0.5">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Concat Axis</label>
                </div>
                <button
                    className="nodrag w-full bg-zinc-900 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                    onClick={handleTrigger}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="truncate font-medium">{currentLabel}</span>
                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 Transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={AXIS_ITEMS}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleSelect}
                    placeholder="Select Axis..."
                    width="40"
                />
            </div>
        </BaseNode>
    );
});
ArrayBuilderNode.displayName = 'ArrayBuilderNode';
