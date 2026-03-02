
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const MATRIX_OPERATIONS: CategorizedMenuItem[] = [
    { id: 'INV', label: 'Inverse', category: 'Linear Algebra', aliases: ['inv'] },
    { id: 'DET', label: 'Determinant', category: 'Linear Algebra', aliases: ['det'] },
    { id: 'TRANSPOSE', label: 'Transpose', category: 'Linear Algebra', aliases: ['transpose', 't', 'swap'] },
    { id: 'TRACE', label: 'Trace', category: 'Linear Algebra', aliases: ['trace'] },
    { id: 'EIGEN', label: 'Eigenvalues (Sym)', category: 'Spectral', aliases: ['eigen', 'eig'] },
    { id: 'QR', label: 'QR Decomposition', category: 'Decomposition', aliases: ['qr'] },
    { id: 'LUP', label: 'LU Decomposition', category: 'Decomposition', aliases: ['lu', 'lup'] },
];

export const MatrixToolsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const [op, setOp] = useState<string>((data.op as string) || 'INV');




    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newOp = item.id;
        setOp(newOp);
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: newOp } }
        });
        closeMenu();
    }, [id]);


    let handles: any[] = [
        { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'matrix' }
    ];

    if (op === 'QR') {
        handles.push(
            { id: 'Q', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'Q' },
            { id: 'R', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'R' }
        );
    } else if (op === 'LUP') {
        handles.push(
            { id: 'L', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'L' },
            { id: 'U', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'U' },
            { id: 'P', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'P' }
        );
    } else if (op === 'EIGEN') {
        handles.push(
            { id: 'values', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'Val' },
            { id: 'vectors', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'Vec' }
        );
    } else {
        handles.push(
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix' }
        );
    }

    const nodeData = { ...data, handles };
    const currentOpLabel = MATRIX_OPERATIONS.find(m => m.id === op)?.label || op;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Operation</label>

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
                    items={MATRIX_OPERATIONS}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleSelect}
                    placeholder="Search Operation..."
                    width="56"
                />
            </div>
        </BaseNode>
    );
});
MatrixToolsNode.displayName = 'MatrixToolsNode';
