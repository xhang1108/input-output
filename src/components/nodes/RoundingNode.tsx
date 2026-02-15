import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

/**
 * 🎯 RoundingNode (MA-12)
 * 
 * Simplified UI for rounding operations.
 * - Single Input (in_a)
 * - Precision controlled by internal selector
 * - Clean interface without preview (as requested)
 */
export const RoundingNode = memo((props: NodeProps) => {
    const { id, data } = props;

    // Precision from data (fallback to 0)
    const precision = data.precision as number ?? 0;

    // 🔒 Define handles EXPLICITLY: Single Input, Single Output
    const handles = [
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Input' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
    ];

    // Merge handles into data for BaseNode
    const nodeData = { ...data, handles };

    const handlePrecisionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const p = parseInt(e.target.value);
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { precision: p } }
        });
    }, [id]);

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-3 p-1 min-w-[140px]">
                {/* Precision Selector */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Round To</label>
                        <span className="text-[9px] text-zinc-600 font-mono bg-zinc-800/50 px-1 rounded">n={precision}</span>
                    </div>
                    <select
                        className="nodrag w-full border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:border-(--color-math) outline-none appearance-none transition-colors"
                        style={{ background: 'var(--node-bg-header)' }}
                        value={precision}
                        onChange={handlePrecisionChange}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <optgroup label="Decimal Places">
                            {[0, 1, 2, 3, 4, 5, 6].map(p => (
                                <option key={p} value={p}>{p} d.p.</option>
                            ))}
                        </optgroup>
                        <optgroup label="Whole Numbers">
                            <option value={-1}>Tens (10)</option>
                            <option value={-2}>Hundreds (100)</option>
                            <option value={-3}>Thousands (k)</option>
                        </optgroup>
                    </select>
                </div>
            </div>
        </BaseNode>
    );
});

RoundingNode.displayName = 'RoundingNode';
