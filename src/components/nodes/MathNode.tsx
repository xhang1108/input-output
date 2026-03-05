
import { memo, useCallback, useState, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const MATH_OPERATIONS: CategorizedMenuItem[] = [
    { id: 'ADD', label: 'Add (+)', category: 'Arithmetic', aliases: ['+', 'sum', 'plus'] },
    { id: 'SUB', label: 'Subtract (-)', category: 'Arithmetic', aliases: ['-', 'diff', 'minus'] },
    { id: 'MUL', label: 'Multiply (*)', category: 'Arithmetic', aliases: ['*', 'prod', 'times'] },
    { id: 'DIV', label: 'Divide (/)', category: 'Arithmetic', aliases: ['/', 'quot', 'by'] },
    { id: 'POW', label: 'Power (^)', category: 'Advanced', aliases: ['^', 'exp'] },
    { id: 'SQRT', label: 'Square Root (√)', category: 'Advanced', aliases: ['sqrt', 'root'] },
    { id: 'ABS', label: 'Absolute (|x|)', category: 'Advanced', aliases: ['abs', 'magnitude'] },
];

export const MathNode = memo((props: NodeProps) => {
    const { id, data, type } = props;
    // Extract definition ID from node type or data if available, but props.id is the instance ID.
    // We usually get the definition ID from the node's type mapping or a data field.
    // However, in this architecture, MA-01 and MA-18 might be mapped to the same Component.
    // Let's check `data.definitionId` or similar if it exists, otherwise we might need to pass it.
    // For now, I'll assume `data.type` or a specific field identifies it.

    // Actually, in Input-Output, the 'type' prop in NodeProps is the React Flow type name.
    // We need to know which definition this node belongs to.
    const definitionId = (data as any)?.definitionId || (props as any).type;

    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const [op, setOp] = useState<string>((data.op as string) || (definitionId === 'MA-02' ? 'POW' : 'ADD'));

    const filteredOperations = useMemo(() => {
        if (definitionId === 'MA-02' || definitionId === 'MA-18') {
            return MATH_OPERATIONS.filter(o => o.category === 'Advanced');
        }
        return MATH_OPERATIONS.filter(o => o.category === 'Arithmetic');
    }, [definitionId]);

    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newOp = item.id;
        setOp(newOp);

        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { op: newOp }
            }
        });
        closeMenu();
    }, [id]);


    const currentOpLabel = MATH_OPERATIONS.find(m => m.id === op)?.label || op;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-1.5 p-1">
                <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-black px-1">
                    {(definitionId === 'MA-02' || definitionId === 'MA-02') ? 'Advanced Operation' : 'Basic Operation'}
                </label>

                <button
                    className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-md px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
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
                    items={filteredOperations}
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
MathNode.displayName = 'MathNode';
