
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const MODE_ITEMS: CategorizedMenuItem[] = [
    { id: 'separate', label: 'Split Vector', category: 'Operation' },
    { id: 'combine', label: 'Combine Vector', category: 'Operation' },
];

export const VectorSplitNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const mode = (data.mode as string) || 'separate'; // 'separate' | 'combine'




    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newMode = item.id;
        const newHandles = newMode === 'separate' ? [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector' },
            { id: 'x', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'X' },
            { id: 'y', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Y' },
            { id: 'z', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Z' }
        ] : [
            { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'scalar', label: 'Split' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'vector' }
        ];

        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: {
                    mode: newMode,
                    handles: newHandles
                }
            }
        });
        closeMenu();
    }, [id]);


    let handles: any[] = [];

    if (mode === 'separate') {
        handles = [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector' },
            { id: 'x', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'X' },
            { id: 'y', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Y' },
            { id: 'z', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Z' }
        ];
    } else {
        handles = [
            { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'scalar', label: 'Split' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'vector' }
        ];
    }

    const nodeData = { ...data, handles };
    const currentLabel = MODE_ITEMS.find(m => m.id === mode)?.label || mode;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Mode</label>
                <button
                    className="nodrag w-full bg-zinc-900 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm"
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
                    items={MODE_ITEMS}
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
VectorSplitNode.displayName = 'VectorSplitNode';
