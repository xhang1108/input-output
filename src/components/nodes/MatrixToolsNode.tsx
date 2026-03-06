
import { memo, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';

export const MatrixToolsNode = memo((props: NodeProps) => {
    const { data } = props;
    const op = (data.op as string) || 'INV';

    // Dynamic handles: QR, LUP, EIGEN decompositions have multiple outputs
    const handles = useMemo<any[]>(() => {
        const base: any[] = [
            { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'matrix' }
        ];
        if (op === 'QR') {
            base.push(
                { id: 'Q', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'Q' },
                { id: 'R', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'R' }
            );
        } else if (op === 'LU') {
            base.push(
                { id: 'L', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'L' },
                { id: 'U', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'U' },
                { id: 'P', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'P' }
            );
        } else if (op === 'EIGEN') {
            base.push(
                { id: 'values', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'Val' },
                { id: 'vectors', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix', label: 'Vec' }
            );
        } else {
            base.push({ id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'matrix' });
        }
        return base;
    }, [op]);

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <NodeOpSelect
                nodeId={props.id}
                defId={props.type}
                paramId="op"
                data={data as Record<string, unknown>}
                label="Operation"
                placeholder="Search Operation..."
                width="56"
            />
        </BaseNode>
    );
});
MatrixToolsNode.displayName = 'MatrixToolsNode';
