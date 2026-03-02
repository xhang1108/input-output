
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const VECTOR_OPERATIONS: CategorizedMenuItem[] = [
    { id: 'DOT', label: 'Dot Product', category: 'Products', aliases: ['dot'] },
    { id: 'CROSS', label: 'Cross Product', category: 'Products', aliases: ['cross'] },
    { id: 'NORM', label: 'Norm (Length)', category: 'Metrics', aliases: ['norm', 'magnitude', 'length'] },
    { id: 'DISTANCE', label: 'Distance', category: 'Metrics', aliases: ['dist'] },
];

export const VectorUtilsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const [op, setOp] = useState<string>((data.op as string) || 'DOT');




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
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector', label: 'A' }
    ];

    if (op !== 'NORM') {
        handles.push({ id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector', label: 'B' });
    }

    handles.push({ id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' });

    const nodeData = { ...data, handles };
    const currentLabel = VECTOR_OPERATIONS.find(v => v.id === op)?.label || op;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-black px-1">Vector Op</label>

                <button
                    className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-md px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                    onClick={handleTrigger}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="truncate font-medium group-hover:text-white uppercase">{currentLabel}</span>
                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={VECTOR_OPERATIONS}
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
VectorUtilsNode.displayName = 'VectorUtilsNode';
