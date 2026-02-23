import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

// We extract handle generation to keep the component clean
function getHandlesForShape(shape: string) {
    const outputs = [
        { id: 'area', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Area' },
        { id: 'perimeter', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Perim' }
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
        // Triangle
        return [
            { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Base' },
            { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Height' },
            ...outputs
        ];
    }
}

export const GeometryNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const shape = (data.shape as string) || 'Circle';

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newShape = e.target.value;
        const newHandles = getHandlesForShape(newShape);

        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: {
                    shape: newShape,
                    handles: newHandles
                }
            }
        });
    }, [id]);

    let handles: any[] = [];
    if (data.handles) {
        handles = data.handles as any[];
    } else {
        handles = getHandlesForShape(shape);
    }

    // Pass merged handles back to BaseNode
    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Shape</label>
                <select
                    className="nodrag w-full border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:border-blue-500 outline-none appearance-none transition-colors"
                    style={{ background: 'var(--node-bg-header)' }}
                    value={shape}
                    onChange={handleChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <option value="Circle">Circle</option>
                    <option value="Quad">Rectangle</option>
                    <option value="Triangle">Triangle</option>
                </select>
            </div>
        </BaseNode>
    );
});
GeometryNode.displayName = 'GeometryNode';
