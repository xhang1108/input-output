import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';

export const ArrayBuilderNode = memo((props: NodeProps) => {
    const { id, data } = props;

    const handles: any[] = [
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'any' },
        { id: 'out_a', type: 'source', position: Position.Right, variant: 'single', dataType: 'array' }
    ];

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData} type="DT-01">
            <div className="flex flex-col gap-1.5">
                <NodeOpSelect 
                    nodeId={id} 
                    defId="DT-01" 
                    paramId="axis" 
                    data={data} 
                    label="Direction"
                />
            </div>
        </BaseNode>
    );
});
ArrayBuilderNode.displayName = 'ArrayBuilderNode';
