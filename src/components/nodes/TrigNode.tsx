import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const OP_ITEMS: CategorizedMenuItem[] = [
    { id: 'SIN', label: 'Sine (sin)', category: 'Trigonometry' },
    { id: 'COS', label: 'Cosine (cos)', category: 'Trigonometry' },
    { id: 'TAN', label: 'Tangent (tan)', category: 'Trigonometry' },
    { id: 'ASIN', label: 'Arc Sine (asin)', category: 'Inverse' },
    { id: 'ACOS', label: 'Arc Cosine (acos)', category: 'Inverse' },
    { id: 'ATAN', label: 'Arc Tangent (atan)', category: 'Inverse' },
];

export const TrigNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const [op, setOp] = useState<string>((data.op as string) || 'SIN');
    const [angleMode, setAngleMode] = useState<string>((data.angleMode as string) || 'RAD');

    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newOp = item.id;
        setOp(newOp);

        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { op: newOp }
            }
        });
        closeMenu();
    }, [id, brain, closeMenu]);

    const toggleAngleMode = useCallback(() => {
        const newMode = angleMode === 'RAD' ? 'DEG' : 'RAD';
        setAngleMode(newMode);
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { angleMode: newMode }
            }
        });
    }, [angleMode, id, brain]);

    const currentLabel = OP_ITEMS.find(i => i.id === op)?.label || op;

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <div className="flex flex-row justify-between items-center">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Function</label>
                    <button
                        className="nodrag text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors uppercase font-bold"
                        onClick={(e) => { e.stopPropagation(); toggleAngleMode(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Toggle Radians/Degrees"
                    >
                        {angleMode}
                    </button>
                </div>

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
                    placeholder="Search Function..."
                    width="48"
                />
            </div>
        </BaseNode>
    );
});
TrigNode.displayName = 'TrigNode';
