
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const MODE_ITEMS: CategorizedMenuItem[] = [
    { id: 'Sort (Asc)', label: 'Sort (Asc)', category: 'Ordering' },
    { id: 'Sort (Desc)', label: 'Sort (Desc)', category: 'Ordering' },
    { id: 'Reverse', label: 'Reverse', category: 'Transformation' },
    { id: 'Unique', label: 'Unique Elements', category: 'Filtering' },
    { id: 'Clean', label: 'Remove Null/NaN', category: 'Filtering' },
];

export const ListUtilityNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();




    const mode = (data.mode as string) || 'Sort (Asc)';

    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newMode = item.id;
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { mode: newMode } }
        });
        closeMenu();
    }, [id]);


    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <button
                    className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm"
                    onClick={handleTrigger}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="truncate font-medium">{mode}</span>
                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={MODE_ITEMS}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleSelect}
                    placeholder="Search Operation..."
                    width="44"
                />
            </div>
        </BaseNode>
    );
});

ListUtilityNode.displayName = 'ListUtilityNode';
