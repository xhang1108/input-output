import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const MatrixToolsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const op = (data.op as string) || 'INV';

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { op: e.target.value } }
        });
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

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Operation</label>
                <select
                    className="nodrag w-full border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:border-(--color-math) outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={op}
                    onChange={handleChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="INV">Inverse</option>
                    <option value="DET">Determinant</option>
                    <option value="TRANSPOSE">Transpose</option>
                    <option value="TRACE">Trace</option>
                    <option value="EIGEN">Eigen (Sym)</option>
                    <option value="QR">QR Decomp</option>
                    <option value="LUP">LU Decomp</option>
                </select>
            </div>
        </BaseNode>
    );
});
MatrixToolsNode.displayName = 'MatrixToolsNode';
