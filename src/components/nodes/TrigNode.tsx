import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { NodeOpSelect } from './NodeOpSelect';

export const TrigNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const [angleMode, setAngleMode] = useState<string>((data.angleMode as string) || 'RAD');


    const toggleAngleMode = useCallback(() => {
        const newMode = angleMode === 'RAD' ? 'DEG' : 'RAD';
        setAngleMode(newMode);
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { angleMode: newMode }
            }
        });
    }, [angleMode, id, brain]);


    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[124px] w-full">
                {/* Mode Toggle as Header Sub-bar */}
                <div className="flex justify-end px-1 mb-1">
                    <button
                        className="nodrag text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200 hover:bg-zinc-700 transition-colors uppercase font-bold"
                        onClick={(e) => { e.stopPropagation(); toggleAngleMode(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {angleMode}
                    </button>
                </div>
                <div className="flex flex-col gap-1.5">
                    <NodeOpSelect 
                        nodeId={id} 
                        defId="MA-04" 
                        paramId="mode" 
                        data={data} 
                        label="Function"
                    />
                </div>
            </div>
        </BaseNode>
    );
});
TrigNode.displayName = 'TrigNode';

