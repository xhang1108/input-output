
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const COMB_OPERATIONS: CategorizedMenuItem[] = [
    { id: 'nCr', label: 'Combinations (nCr)', category: 'Combinatorics', aliases: ['ncr', 'choose'] },
    { id: 'nPr', label: 'Permutations (nPr)', category: 'Combinatorics', aliases: ['npr', 'permute'] },
    { id: 'n!', label: 'Factorial (n!)', category: 'Probability', aliases: ['factorial'] },
];

export const CombinatoricsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const [op, setOp] = useState<string>((data.op as string) || 'nCr');




    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newOp = item.id;
        setOp(newOp);
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: newOp } }
        });
        closeMenu();
    }, [id]);


    const handles: any[] = [
        { id: 'n', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'n' }
    ];

    if (op !== 'n!') {
        handles.push({ id: 'r', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'r' });
    }

    handles.push({ id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' });

    const nodeData = { ...data, handles };
    const currentLabel = COMB_OPERATIONS.find(c => c.id === op)?.label || op;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Operation</label>

                <button
                    className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
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
                    items={COMB_OPERATIONS}
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
CombinatoricsNode.displayName = 'CombinatoricsNode';
