
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const OP_ITEMS: CategorizedMenuItem[] = [
    { id: 'LN', label: 'Ln (Base e)', category: 'Natural' },
    { id: 'LOG10', label: 'Log 10', category: 'Common' },
    { id: 'LOG_N', label: 'Log Base N', category: 'General' },
];

export const LogNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const [op, setOp] = useState<string>((data.op as string) || 'LN');




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


    const currentLabel = OP_ITEMS.find(i => i.id === op)?.label || op;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Base Mode</label>
                <button
                    className="nodrag w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group"
                    onClick={handleTrigger}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="truncate">{currentLabel}</span>
                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={OP_ITEMS}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleSelect}
                    placeholder="Search Mode..."
                    width="40"
                />
            </div>
        </BaseNode>
    );
});
LogNode.displayName = 'LogNode';
