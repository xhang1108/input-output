import { memo, useCallback, useMemo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { BaseNode, HandleConfig } from './BaseNode';
import { Brain } from '../../engine/Brain';

const CONSTANTS = [
    { label: 'π', value: 'pi' },
    { label: 'τ', value: 'tau' },
    { label: 'e', value: 'e' },
    { label: 'i', value: 'i' },
    { label: 'φ', value: 'phi' },
    { label: '∞', value: 'Infinity' },
    { label: 'NaN', value: 'NaN' }
];

const HANDLES: HandleConfig[] = [
    { id: 'val', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
];

export const ConstantNode = memo((props: NodeProps) => {
    const { id, data } = props;

    // Force handles for Constant Node
    const dataWithHandles = useMemo(() => ({
        ...data,
        handles: HANDLES
    }), [data]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { val }
            }
        });
    }, [id]);

    const handlePrecisionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const precision = parseInt(e.target.value);
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { precision }
            }
        });
    }, [id]);

    const precision = data.precision as number | undefined;

    return (
        <BaseNode {...props} data={dataWithHandles}>
            <div className="flex flex-col gap-1 p-1 min-w-[70px]">
                <div className="flex items-center justify-center">
                    <select
                        className="nodrag bg-zinc-800 text-zinc-200 text-lg font-serif italic border border-zinc-700 rounded px-2 py-1 outline-none focus:border-blue-500 w-full text-center appearance-none cursor-pointer hover:bg-zinc-700 transition-colors"
                        value={data.val as string || 'pi'}
                        onChange={handleChange}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Select Constant"
                    >
                        {CONSTANTS.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-center">
                    <select
                        className="nodrag bg-transparent text-[9px] text-zinc-600 border-none outline-none cursor-pointer hover:text-zinc-400"
                        value={precision ?? -1}
                        onChange={handlePrecisionChange}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <option value={-1}>High Prec.</option>
                        {[0, 1, 2, 3, 4, 5, 6, 8, 10].map(p => (
                            <option key={p} value={p}>{p} d.p.</option>
                        ))}
                    </select>
                </div>
            </div>
        </BaseNode>
    );
});
ConstantNode.displayName = 'ConstantNode';
