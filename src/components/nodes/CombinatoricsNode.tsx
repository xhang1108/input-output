
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { NodeOpSelect } from './NodeOpSelect';

export const CombinatoricsNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const op = (data.op as string) || 'nCr';


    const handles: any[] = [
        { id: 'n', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'n' }
    ];

    if (op !== 'n!') {
        handles.push({ id: 'r', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'r' });
    }

    handles.push({ id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' });

    const nodeData = { ...data, handles };
    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <NodeOpSelect
                    nodeId={id}
                    defId="MA-08"
                    paramId="op"
                    data={data}
                    label="Operation"
                    width="48"
                />
            </div>
        </BaseNode>
    );
});
CombinatoricsNode.displayName = 'CombinatoricsNode';
