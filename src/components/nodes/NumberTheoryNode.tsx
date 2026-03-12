
import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const NT_OPERATIONS: CategorizedMenuItem[] = [
    { id: 'GCD', label: 'GCD (Greatest Common Divisor)', category: 'Integer Functions', aliases: ['gcd'] },
    { id: 'LCM', label: 'LCM (Least Common Multiple)', category: 'Integer Functions', aliases: ['lcm'] },
    { id: 'MOD', label: 'Modulo (%)', category: 'Arithmetic', aliases: ['mod', 'remainder'] },
    { id: 'IS_PRIME', label: 'Is Prime?', category: 'Tests', aliases: ['prime'] },
];

// Explicit map: which ops produce scalar vs boolean output
const NT_OP_OUTPUT: Record<string, 'scalar' | 'boolean'> = {
    IS_PRIME: 'boolean', // Test → bool
    GCD: 'scalar',  // Result → number
    LCM: 'scalar',  // Result → number
    MOD: 'scalar',  // Result → number
};

export const NumberTheoryNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const op = (data.op as string) || 'GCD';

    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newOp = item.id;
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: newOp } }
        });
        closeMenu();
    }, [id, brain, closeMenu]);

    // Dynamic handles
    const handles = [
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'A' },
        { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'B' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: NT_OP_OUTPUT[op] ?? 'scalar' }
    ];

    const nodeData = { ...data, handles };
    const currentLabel = NT_OPERATIONS.find(n => n.id === op)?.label || op;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[140px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Operation</label>

                <button
                    className="nodrag w-full bg-zinc-900/50 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
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
                    items={NT_OPERATIONS}
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
NumberTheoryNode.displayName = 'NumberTheoryNode';
