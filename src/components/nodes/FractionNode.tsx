
import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const FractionNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();

    const isMixed = data.mixed === true;

    const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        updateNodeData(id, { mixed: checked });
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { mixed: checked } }
        });
    };

    return (
        <BaseNode {...props}>
            <div className="flex items-center gap-2 px-1 min-w-[120px]">
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={isMixed}
                        onChange={handleToggle}
                        className="rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                    />
                    <span>Mixed Form</span>
                </label>
            </div>
        </BaseNode>
    );
});

FractionNode.displayName = 'FractionNode';
