
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const MODE_ITEMS: CategorizedMenuItem[] = [
    { id: 'ROUND', label: 'Round (nearest)', category: 'Mode' },
    { id: 'FLOOR', label: 'Floor (↓)', category: 'Mode' },
    { id: 'CEIL', label: 'Ceiling (↑)', category: 'Mode' },
    { id: 'TRUNC', label: 'Truncate', category: 'Mode' }
];

const PRECISION_ITEMS: CategorizedMenuItem[] = [
    { id: '0', label: '0 d.p.', category: 'Decimal Places' },
    { id: '1', label: '1 d.p.', category: 'Decimal Places' },
    { id: '2', label: '2 d.p.', category: 'Decimal Places' },
    { id: '3', label: '3 d.p.', category: 'Decimal Places' },
    { id: '4', label: '4 d.p.', category: 'Decimal Places' },
    { id: '5', label: '5 d.p.', category: 'Decimal Places' },
    { id: '6', label: '6 d.p.', category: 'Decimal Places' },
    { id: '-1', label: 'Tens (10)', category: 'Whole Numbers' },
    { id: '-2', label: 'Hundreds (100)', category: 'Whole Numbers' },
    { id: '-3', label: 'Thousands (k)', category: 'Whole Numbers' },
];

export const RoundingNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const opMenu = useNodeMenu();
    const precMenu = useNodeMenu();

    const op = (data.op as string) || 'ROUND';
    const precision = data.precision as number ?? 0;

    const handles = [
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Input' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
    ];

    const nodeData = { ...data, handles };

    const handleOpSelect = useCallback((item: CategorizedMenuItem) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: item.id } }
        });
        opMenu.closeMenu();
    }, [id, opMenu]);

    const handlePrecSelect = useCallback((item: CategorizedMenuItem) => {
        const p = parseInt(item.id);
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { precision: p } }
        });
        precMenu.closeMenu();
    }, [id, precMenu]);

    const currentOpLabel = MODE_ITEMS.find(i => i.id === op)?.label || 'Round';
    const currentPrecLabel = PRECISION_ITEMS.find(i => i.id === precision.toString())?.label || `${precision} d.p.`;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-3 p-1 min-w-[140px]">
                {/* Mode Selector */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Mode</label>
                    </div>

                    <button
                        className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-md px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                        onClick={opMenu.handleTrigger}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <span className="truncate font-medium group-hover:text-white">{currentOpLabel}</span>
                        <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        placeholder="Search Mode..."
                        width="48"
                    />
                </div>

                {/* Precision Selector (Only visible if ROUND) */}
                {op === 'ROUND' && (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Round To</label>
                            <span className="text-[9px] text-zinc-600 font-mono bg-zinc-800/50 px-1 rounded">n={precision}</span>
                        </div>

                        <button
                            className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-md px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                            onClick={precMenu.handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="truncate font-medium group-hover:text-white">{currentPrecLabel}</span>
                            <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        <CategorizedMenu
                            isOpen={precMenu.menuOpen}
                            items={PRECISION_ITEMS}
                            position={precMenu.menuPos}
                            trigger={precMenu.trigger}
                            onClose={precMenu.closeMenu}
                            onSelect={handlePrecSelect}
                            placeholder="Search Precision..."
                            width="48"
                        />
                    </div>
                )}
            </div>
        </BaseNode>
    );
});

RoundingNode.displayName = 'RoundingNode';
