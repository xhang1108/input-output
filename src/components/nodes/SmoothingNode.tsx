import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const SmoothingNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const windowMode = data.windowMode !== undefined ? Number(data.windowMode) : 3;

    const updateData = useCallback((updates: Partial<typeof data>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: updates }
        });
    }, [id]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <div className="flex items-center justify-between border border-zinc-700/50 rounded p-1 bg-black/10">
                    <label className="text-[9px] text-zinc-500 uppercase font-bold text-right pr-2">Window</label>
                    <input
                        type="number"
                        className="nodrag w-16 border border-zinc-700/50 rounded px-1 text-xs text-zinc-300 focus:border-blue-500/50 outline-none transition-colors"
                        style={{ background: 'var(--node-bg-header)' }}
                        value={windowMode}
                        onChange={(e) => updateData({ windowMode: Number(e.target.value) })}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                </div>
            </div>
        </BaseNode>
    );
});

SmoothingNode.displayName = 'SmoothingNode';
