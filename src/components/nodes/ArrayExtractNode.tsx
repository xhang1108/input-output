import { memo, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { NodeOpSelect } from './NodeOpSelect';

export const ArrayExtractNode = memo((props: NodeProps) => {
    const { data } = props;
    const indexMode = (data.indexMode as string) || '1D';

    // Dynamic: 2D mode changes the index handle label to (r,c)
    const handles = useMemo<any[]>(() => [
        { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'matrix', label: 'Matrix' },
        { id: 'index', type: 'target', position: Position.Left, variant: 'single', dataType: 'vector', label: indexMode === '2D' ? 'Idx (r,c)' : 'Idx' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'any' }
    ], [indexMode]);

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <NodeOpSelect
                nodeId={props.id}
                defId={props.type}
                paramId="indexMode"
                data={data as Record<string, unknown>}
                label="Index Mode"
                placeholder="Select Mode..."
                width="44"
            />
        </BaseNode>
    );
});
ArrayExtractNode.displayName = 'ArrayExtractNode';
