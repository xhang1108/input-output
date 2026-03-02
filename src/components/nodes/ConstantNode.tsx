import { memo, useCallback, useMemo, useState } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { BaseNode, HandleConfig } from './BaseNode';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const CONSTANT_ITEMS: CategorizedMenuItem[] = [
    { id: 'pi', label: 'π (Pi)', category: 'Mathematical', aliases: ['pi', '3.14'] },
    { id: 'tau', label: 'τ (Tau)', category: 'Mathematical', aliases: ['tau', '6.28'] },
    { id: 'e', label: 'e (Euler)', category: 'Mathematical', aliases: ['e', 'euler', '2.718'] },
    { id: 'phi', label: 'φ (Phi)', category: 'Mathematical', aliases: ['phi', 'golden', '1.618'] },
    { id: 'i', label: 'i (Imaginary)', category: 'Scientific', aliases: ['i', 'sqrt(-1)'] },
    { id: 'Infinity', label: '∞ (Infinity)', category: 'Numerical', aliases: ['inf', 'infinity'] },
    { id: 'NaN', label: 'NaN', category: 'Numerical', aliases: ['nan', 'undefined'] }
];

const PRECISION_ITEMS: CategorizedMenuItem[] = [
    { id: '-1', label: 'High Prec.', category: 'Accuracy' },
    { id: '0', label: '0 d.p.', category: 'Decimal Places' },
    { id: '1', label: '1 d.p.', category: 'Decimal Places' },
    { id: '2', label: '2 d.p.', category: 'Decimal Places' },
    { id: '3', label: '3 d.p.', category: 'Decimal Places' },
    { id: '4', label: '4 d.p.', category: 'Decimal Places' },
    { id: '5', label: '5 d.p.', category: 'Decimal Places' },
    { id: '6', label: '6 d.p.', category: 'Decimal Places' },
    { id: '8', label: '8 d.p.', category: 'Decimal Places' },
    { id: '10', label: '10 d.p.', category: 'Decimal Places' },
];

const HANDLES: HandleConfig[] = [
    { id: 'val', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
];

export const ConstantNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const constMenu = useNodeMenu();
    const precMenu = useNodeMenu();

    const constantVal = data.val as string || 'pi';
    const precision = data.precision as number ?? -1;

    // Force handles for Constant Node
    const dataWithHandles = useMemo(() => ({
        ...data,
        handles: HANDLES
    }), [data]);

    const handleConstantSelect = useCallback((item: CategorizedMenuItem) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { val: item.id } }
        });
        constMenu.closeMenu();
    }, [id, constMenu]);

    const handlePrecisionSelect = useCallback((item: CategorizedMenuItem) => {
        const p = parseInt(item.id);
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { precision: p } }
        });
        precMenu.closeMenu();
    }, [id, precMenu]);

    const handleConstTrigger = (e: React.MouseEvent) => {
        constMenu.handleTrigger(e);
        precMenu.closeMenu();
    };

    const handlePrecTrigger = (e: React.MouseEvent) => {
        precMenu.handleTrigger(e);
        constMenu.closeMenu();
    };

    const currentConstLabel = CONSTANT_ITEMS.find(c => c.id === constantVal)?.label.split(' ')[0] || constantVal;
    const currentPrecLabel = PRECISION_ITEMS.find(p => p.id === precision.toString())?.label || 'Custom';

    return (
        <BaseNode {...props} data={dataWithHandles}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[80px]">
                <div className="flex items-center justify-center">
                    <button
                        className="nodrag w-full bg-zinc-800 text-zinc-200 text-xl font-serif italic border border-zinc-700 rounded px-2 py-1.5 outline-none hover:bg-zinc-700 transition-all flex items-center justify-center gap-1 group active:scale-95"
                        onClick={handleConstTrigger}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <span>{currentConstLabel}</span>
                        <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                <div className="flex justify-center">
                    <button
                        className="nodrag flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all"
                        onClick={handlePrecTrigger}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <span>{currentPrecLabel}</span>
                        <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                <CategorizedMenu
                    isOpen={constMenu.menuOpen}
                    items={CONSTANT_ITEMS}
                    position={constMenu.menuPos}
                    trigger={constMenu.trigger}
                    onClose={constMenu.closeMenu}
                    onSelect={handleConstantSelect}
                    placeholder="Search Constant..."
                    width="40"
                />

                <CategorizedMenu
                    isOpen={precMenu.menuOpen}
                    items={PRECISION_ITEMS}
                    position={precMenu.menuPos}
                    trigger={precMenu.trigger}
                    onClose={precMenu.closeMenu}
                    onSelect={handlePrecisionSelect}
                    placeholder="Set Precision..."
                    width="32"
                />
            </div>
        </BaseNode>
    );
});
ConstantNode.displayName = 'ConstantNode';
