
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const STAT_OPERATIONS: CategorizedMenuItem[] = [
    { id: 'Mean', label: 'Mean (Average)', category: 'Central Tendency', aliases: ['avg', 'mean'] },
    { id: 'Median', label: 'Median', category: 'Central Tendency', aliases: ['median'] },
    { id: 'Sum', label: 'Sum', category: 'Central Tendency', aliases: ['total', 'sum', 'add'] },
    { id: 'StdDev', label: 'Standard Deviation', category: 'Dispersion', aliases: ['stddev', 'sigma'] },
    { id: 'Variance', label: 'Variance', category: 'Dispersion', aliases: ['var'] },
    { id: 'Max', label: 'Maximum', category: 'Extreme Values', aliases: ['max', 'highest'] },
    { id: 'Min', label: 'Minimum', category: 'Extreme Values', aliases: ['min', 'lowest'] },
];

export const StatisticsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const [op, setOp] = useState<string>((data.op as string) || 'Mean');




    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newOp = item.id;
        setOp(newOp);
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: newOp } }
        });
        closeMenu();
    }, [id]);


    const currentOpLabel = STAT_OPERATIONS.find(m => m.id === op)?.label || op;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <button
                    className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-(--radius-sm) px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                    onClick={handleTrigger}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="truncate font-medium group-hover:text-white">{currentOpLabel}</span>
                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={STAT_OPERATIONS}
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

StatisticsNode.displayName = 'StatisticsNode';
