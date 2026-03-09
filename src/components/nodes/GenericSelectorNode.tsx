import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';

/**
 * GenericSelectorNode
 * 
 * A unified component for nodes that primarily function as an operation selector.
 * Replaces specialized nodes like MathNode, StatisticsNode, SetOpsNode, etc.
 * Everything is driven by NODE_DEFINITIONS.
 */
export const GenericSelectorNode = memo((props: NodeProps) => {
    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-1.5">
                <NodeOpSelect
                    nodeId={props.id}
                    defId={props.type}
                    paramId="op"
                    data={props.data as Record<string, unknown>}
                    placeholder="Search Operation..."
                    width="48"
                />
            </div>
        </BaseNode>
    );
});

GenericSelectorNode.displayName = 'GenericSelectorNode';
