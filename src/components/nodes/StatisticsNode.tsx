
import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';

export const StatisticsNode = memo((props: NodeProps) => {
    return (
        <BaseNode {...props}>
            <NodeOpSelect
                nodeId={props.id}
                defId={props.type}
                paramId="op"
                data={props.data as Record<string, unknown>}
                placeholder="Search Operation..."
                width="48"
            />
        </BaseNode>
    );
});

StatisticsNode.displayName = 'StatisticsNode';
