import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { NumericInput } from '../common/NumericInput';

export const SmoothingNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const windowMode = data.windowMode !== undefined ? Number(data.windowMode) : 3;

    const updateData = useCallback((updates: Partial<typeof data>) => {
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: updates }
        });
    }, [id, brain]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <div className="flex flex-col gap-1 px-1">
                    <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Window Size</span>
                    <NumericInput
                        value={windowMode}
                        onChange={(val) => updateData({ windowMode: val })}
                        hideLabel={true}
                        inputClassName="w-full h-6 text-[10px] px-1 text-center"
                    />
                </div>
            </div>
        </BaseNode>
    );
});

SmoothingNode.displayName = 'SmoothingNode';

