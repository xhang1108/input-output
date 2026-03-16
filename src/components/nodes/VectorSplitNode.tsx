
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { NodeOpSelect } from './NodeOpSelect';

export const VectorSplitNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const mode = (data.mode as string) || 'separate'; // 'separate' | 'combine'






    let handles: any[] = [];

    if (mode === 'separate') {
        handles = [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'array' },
            { id: 'x', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'X' },
            { id: 'y', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Y' },
            { id: 'z', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Z' }
        ];
    } else {
        handles = [
            { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'scalar', label: 'Split' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'array' }
        ];
    }

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <div className="flex flex-col">
                    <NodeOpSelect 
                        nodeId={id} 
                        defId="DT-06" 
                        paramId="mode" 
                        data={data} 
                        label="Split Mode"
                        onSelect={(item) => {
                            const newMode = item.id;
                            const newHandles = newMode === 'separate' ? [
                                { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'array' },
                                { id: 'x', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'X' },
                                { id: 'y', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Y' },
                                { id: 'z', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Z' }
                            ] : [
                                { id: 'in', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'scalar', label: 'Split' },
                                { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'array' }
                            ];

                            brain.applyTransaction({
                                type: 'UPDATE_NODE_DATA',
                                payload: {
                                    id,
                                    data: {
                                        mode: newMode,
                                        handles: newHandles
                                    }
                                }
                            });
                        }}
                    />
                </div>
            </div>
        </BaseNode>
    );
});
VectorSplitNode.displayName = 'VectorSplitNode';
