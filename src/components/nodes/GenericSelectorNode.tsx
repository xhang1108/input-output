import { memo, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';
import { NODE_DEFINITIONS } from '../../definitions/nodeDefinitions';

/**
 * GenericSelectorNode
 * 
 * A unified component for nodes that primarily function as an operation selector.
 * Replaces specialized nodes like MathNode, StatisticsNode, SetOpsNode, etc.
 * Everything is driven by NODE_DEFINITIONS.
 */
export const GenericSelectorNode = memo((props: NodeProps) => {
    // Dynamic Param Detection: 
    // Find the first 'select' parameter from the definition.
    // This allows support for nodes using 'op' (Math) AND 'mode' (List Utility).
    const paramId = useMemo(() => {
        const def = NODE_DEFINITIONS.find(d => d.id === props.type);
        if (!def || !def.params) return 'op'; // Fallback

        const selectParam = def.params.find(p => p.type === 'select');
        return selectParam?.id || 'op';
    }, [props.type]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-1.5">
                <NodeOpSelect
                    nodeId={props.id}
                    defId={props.type}
                    paramId={paramId}
                    data={props.data as Record<string, unknown>}
                    placeholder="Search Operation..."
                    width="48"
                />
            </div>
        </BaseNode>
    );
});

GenericSelectorNode.displayName = 'GenericSelectorNode';
