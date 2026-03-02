
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const LOGIC_OPERATIONS: CategorizedMenuItem[] = [
    { id: 'AND', label: 'AND (&&)', category: 'Boolean Gates', aliases: ['and', 'gate'] },
    { id: 'OR', label: 'OR (||)', category: 'Boolean Gates', aliases: ['or', 'gate'] },
    { id: 'NOT', label: 'NOT (!)', category: 'Boolean Gates', aliases: ['not', 'gate', 'inv'] },
    { id: 'XOR', label: 'XOR (⊕)', category: 'Boolean Gates', aliases: ['xor', 'gate'] },
    { id: 'EQ', label: 'Equal (==)', category: 'Comparisons', aliases: ['eq', 'equal'] },
    { id: 'NEQ', label: 'Not Equal (!=)', category: 'Comparisons', aliases: ['neq', 'not equal'] },
    { id: 'GT', label: 'Greater Than (>)', category: 'Comparisons', aliases: ['gt', 'greater'] },
    { id: 'LT', label: 'Less Than (<)', category: 'Comparisons', aliases: ['lt', 'less'] },
    { id: 'GTE', label: 'Greater or Equal (>=)', category: 'Comparisons', aliases: ['gte'] },
    { id: 'LTE', label: 'Less or Equal (<=)', category: 'Comparisons', aliases: ['lte'] },
];

export const LogicNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const [op, setOp] = useState<string>((data.op as string) || 'AND');
    const { updateNodeData } = useReactFlow();




    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newOp = item.id;
        const newLabel = item.label.split(' ')[0];
        setOp(newOp);

        updateNodeData(id, { op: newOp, label: newLabel });
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: newOp, label: newLabel } }
        });
        closeMenu();
    }, [id, updateNodeData]);


    const currentOpLabel = LOGIC_OPERATIONS.find(m => m.id === op)?.label || op;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Operation</label>

                <button
                    className="nodrag w-full bg-zinc-900/50 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                    onClick={handleTrigger}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="truncate font-medium group-hover:text-white uppercase">{currentOpLabel}</span>
                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={LOGIC_OPERATIONS}
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

LogicNode.displayName = 'LogicNode';
