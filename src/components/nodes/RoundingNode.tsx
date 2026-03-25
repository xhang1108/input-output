
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { NodeOpSelect } from './NodeOpSelect';

export const RoundingNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

    const op = (data.op as string) || 'ROUND';
    const precision = data.precision as number ?? 0;

    const handles = [
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Input' },
        { id: 'out_a', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
    ];

    const nodeData = { ...data, handles };



    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-3 p-1 min-w-[140px]">
                {/* Mode Selector */}
                <div className="flex flex-col">
                    <NodeOpSelect 
                        nodeId={id} 
                        defId="MA-05" 
                        paramId="op" 
                        data={data} 
                        label="Rounding Mode"
                        width="44"
                    />
                </div>

                {/* Precision Selector (Only visible if ROUND) */}
                {op === 'ROUND' && (
                    <div className="flex flex-col border-t border-zinc-800/30 pt-2 -mt-1">
                        <NodeOpSelect 
                            nodeId={id} 
                            defId="MA-05" 
                            paramId="precision" 
                            data={data} 
                            label="Set Precision"
                            width="40"
                        />
                    </div>
                )}

            </div>
        </BaseNode>
    );
});

RoundingNode.displayName = 'RoundingNode';
