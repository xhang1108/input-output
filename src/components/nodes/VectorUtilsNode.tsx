
import { memo, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';

export const VectorUtilsNode = memo((props: NodeProps) => {
    const { data } = props;
    const op = (data.op as string) || 'DOT';

    // Dynamic handles based on op: NORM only needs one input
    const handles = useMemo<any[]>(() => {
        const h: any[] = [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector', label: 'A' }
        ];
        if (op !== 'NORM') {
            h.push({ id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector', label: 'B' });
        }
        h.push({ id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' });
        return h;
    }, [op]);

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <NodeOpSelect
                nodeId={props.id}
                defId={props.type}
                paramId="op"
                data={data as Record<string, unknown>}
                label="Vector Op"
                placeholder="Search Operation..."
                width="48"
            />
        </BaseNode>
    );
});
VectorUtilsNode.displayName = 'VectorUtilsNode';
