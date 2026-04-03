
import { memo, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';

// Explicit map: which ops produce a scalar vs vector output
const VECTOR_OP_OUTPUT: Record<string, 'scalar' | 'array'> = {
    DOT: 'scalar',  // dot product → number
    NORM: 'scalar',  // magnitude → number
    DISTANCE: 'scalar',  // distance → number
    CROSS: 'array',   // cross product → 3D vector
};

export const VectorUtilsNode = memo((props: NodeProps) => {
    const { data } = props;
    const op = (data.mode as string) || (data.op as string) || 'DOT';

    // Dynamic handles based on op: NORM only needs one input
    const handles = useMemo<any[]>(() => {
        const h: any[] = [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'array', label: 'A' }
        ];
        if (op !== 'NORM') {
            h.push({ id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'array', label: 'B' });
        }
        h.push({ id: 'out_a', type: 'source', position: Position.Right, variant: 'single', dataType: VECTOR_OP_OUTPUT[op] ?? 'scalar' });
        return h;
    }, [op]);

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <NodeOpSelect
                nodeId={props.id}
                defId={props.type}
                paramId="mode"
                data={data as Record<string, unknown>}
                label="Vector Op"
                placeholder="Search Operation..."
                width="48"
            />
        </BaseNode>
    );
});
VectorUtilsNode.displayName = 'VectorUtilsNode';

