
import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';

// LogicNode also syncs data.label (the node's badge title) when op changes.
// We use the `extraData` callback to compute the label from the selected option's first word.
export const LogicNode = memo((props: NodeProps) => {
    // e.g. 'AND (&&)' → label: 'AND'
    const computeExtra = useCallback((value: string) => {
        const options = [
            { id: 'AND', label: 'AND' }, { id: 'OR', label: 'OR' }, { id: 'NOT', label: 'NOT' },
            { id: 'XOR', label: 'XOR' }, { id: 'EQ', label: 'Equal' }, { id: 'NEQ', label: 'Not Equal' },
            { id: 'GT', label: 'GT' }, { id: 'LT', label: 'LT' }, { id: 'GTE', label: 'GTE' }, { id: 'LTE', label: 'LTE' },
        ];
        const label = options.find(o => o.id === value)?.label ?? value;
        return { label };
    }, []);

    return (
        <BaseNode {...props}>
            <NodeOpSelect
                nodeId={props.id}
                defId={props.type}
                paramId="mode"
                data={props.data as Record<string, unknown>}
                label="Operation"
                width="48"
                extraData={computeExtra}
            />
        </BaseNode>
    );
});

LogicNode.displayName = 'LogicNode';
