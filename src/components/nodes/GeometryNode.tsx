import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { NodeOpSelect } from './NodeOpSelect';

function getHandlesForShape(shape: string) {
    const outputs = [
        { id: 'out_a', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Area' },
        { id: 'out_b', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Perim' }
    ];

    if (shape === 'Circle') {
        return [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Radius' },
            ...outputs
        ];
    } else if (shape === 'Quad') {
        return [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Width' },
            { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Height' },
            ...outputs
        ];
    } else {
        return [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Base' },
            { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Height' },
            ...outputs
        ];
    }
}

export const GeometryNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const shape = (data.shape as string) || 'Circle';


    let handles: any[] = [];
    if (data.handles) {
        handles = data.handles as any[];
    } else {
        handles = getHandlesForShape(shape);
    }

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <div className="flex flex-col">
                    <NodeOpSelect 
                        nodeId={id} 
                        defId="TR-03" 
                        paramId="shape" 
                        data={data} 
                        label="Shape"
                        onSelect={(item) => {
                            const newShape = item.id;
                            const newHandles = getHandlesForShape(newShape);

                            brain.applyTransaction({
                                type: 'UPDATE_NODE_DATA',
                                payload: {
                                    id,
                                    data: {
                                        shape: newShape,
                                        handles: newHandles
                                    }
                                }
                            });
                        }}
                    />
                </div>
            </div>
        </BaseNode>
    );
});

GeometryNode.displayName = 'GeometryNode';

