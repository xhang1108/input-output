import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const SetOpsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const mode = (data.mode as string) || 'Union';

    const handleModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMode = e.target.value;
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { mode: newMode } }
        });
    }, [id]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <select
                    className="nodrag w-full border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={mode}
                    onChange={handleModeChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="Union">Union (A ∪ B)</option>
                    <option value="Intersection">Intersection (A ∩ B)</option>
                    <option value="Difference">Difference (A \ B)</option>
                </select>
            </div>
        </BaseNode>
    );
});

SetOpsNode.displayName = 'SetOpsNode';
