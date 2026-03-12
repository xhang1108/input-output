import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const MODE_ITEMS: CategorizedMenuItem[] = [
    { id: 'BUILD', label: 'Build Array', category: 'Operation' },
    { id: 'CONCAT', label: 'Concatenate', category: 'Operation' },
];

const AXIS_ITEMS: CategorizedMenuItem[] = [
    { id: '0', label: 'Axis 0 (Rows)', category: 'Concatenation' },
    { id: '1', label: 'Axis 1 (Cols)', category: 'Concatenation' },
];

export const ArrayBuilderNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const opMenu = useNodeMenu();
    const axisMenu = useNodeMenu();

    const op = (data.op as string) || 'BUILD';
    const axis = (data.axis as number) ?? 0;

    const handleOpSelect = useCallback((item: CategorizedMenuItem) => {
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: item.id } }
        });
        opMenu.closeMenu();
    }, [id, brain, opMenu]);

    const handleAxisSelect = useCallback((item: CategorizedMenuItem) => {
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { axis: parseInt(item.id) } }
        });
        axisMenu.closeMenu();
    }, [id, brain, axisMenu]);

    const handles: any[] = [
        { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'any' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'array' }
    ];

    const nodeData = { ...data, handles };
    const currentOpLabel = MODE_ITEMS.find(i => i.id === op)?.label || op;
    const currentAxisLabel = AXIS_ITEMS.find(i => i.id === axis.toString())?.label || `Axis ${axis}`;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                {/* Mode Selector */}
                <div className="flex justify-between items-center px-1 pb-0.5">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Mode</label>
                </div>
                <button
                    className="nodrag w-full bg-zinc-900 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95 mb-1"
                    onClick={opMenu.handleTrigger}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="truncate font-medium">{currentOpLabel}</span>
                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 Transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                <CategorizedMenu
                    isOpen={opMenu.menuOpen}
                    items={MODE_ITEMS}
                    position={opMenu.menuPos}
                    trigger={opMenu.trigger}
                    onClose={opMenu.closeMenu}
                    onSelect={handleOpSelect}
                    placeholder="Select Mode..."
                    width="44"
                />

                {/* Axis Selector (Only visible for CONCAT) */}
                {op === 'CONCAT' && (
                    <>
                        <div className="flex justify-between items-center px-1 pb-0.5 mt-1">
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Concat Axis</label>
                        </div>
                        <button
                            className="nodrag w-full bg-zinc-900 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                            onClick={axisMenu.handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="truncate font-medium">{currentAxisLabel}</span>
                            <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 Transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <CategorizedMenu
                            isOpen={axisMenu.menuOpen}
                            items={AXIS_ITEMS}
                            position={axisMenu.menuPos}
                            trigger={axisMenu.trigger}
                            onClose={axisMenu.closeMenu}
                            onSelect={handleAxisSelect}
                            placeholder="Select Axis..."
                            width="40"
                        />
                    </>
                )}
            </div>
        </BaseNode>
    );
});
ArrayBuilderNode.displayName = 'ArrayBuilderNode';
