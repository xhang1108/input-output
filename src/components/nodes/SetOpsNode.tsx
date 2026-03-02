
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const SET_OPERATIONS: CategorizedMenuItem[] = [
    { id: 'Union', label: 'Union (A ∪ B)', category: 'Set Operations', aliases: ['union', 'or'] },
    { id: 'Intersection', label: 'Intersection (A ∩ B)', category: 'Set Operations', aliases: ['intersection', 'and'] },
    { id: 'Difference', label: 'Difference (A \\ B)', category: 'Set Operations', aliases: ['difference', 'minus', 'sub'] },
];

export const SetOpsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const [mode, setMode] = useState<string>((data.mode as string) || 'Union');




    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newMode = item.id;
        setMode(newMode);
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { mode: newMode } }
        });
        closeMenu();
    }, [id]);


    const currentLabel = SET_OPERATIONS.find(s => s.id === mode)?.label || mode;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <button
                    className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-(--radius-sm) px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                    onClick={handleTrigger}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="truncate font-medium group-hover:text-white">{currentLabel}</span>
                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={SET_OPERATIONS}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleSelect}
                    placeholder="Search Operation..."
                    width="48"
                />
            </div>
        </BaseNode>
    );
});

SetOpsNode.displayName = 'SetOpsNode';
