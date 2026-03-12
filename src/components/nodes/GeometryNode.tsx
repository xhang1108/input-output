import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const SHAPE_ITEMS: CategorizedMenuItem[] = [
    { id: 'Circle', label: 'Circle', category: '2D Shapes', aliases: ['circle', 'round'] },
    { id: 'Quad', label: 'Rectangle', category: '2D Shapes', aliases: ['rect', 'quad', 'square'] },
    { id: 'Triangle', label: 'Triangle', category: '2D Shapes', aliases: ['tri'] },
];

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
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const shape = (data.shape as string) || 'Circle';

    const handleSelect = useCallback((item: CategorizedMenuItem) => {
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
        closeMenu();
    }, [id, brain, closeMenu]);

    let handles: any[] = [];
    if (data.handles) {
        handles = data.handles as any[];
    } else {
        handles = getHandlesForShape(shape);
    }

    const nodeData = { ...data, handles };
    const currentLabel = SHAPE_ITEMS.find(s => s.id === shape)?.label || shape;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Shape</label>

                <button
                    className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                    onClick={handleTrigger}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <span className="truncate font-medium group-hover:text-white">{currentLabel}</span>
                    <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={SHAPE_ITEMS}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleSelect}
                    placeholder="Search Shape..."
                    width="40"
                />
            </div>
        </BaseNode>
    );
});

GeometryNode.displayName = 'GeometryNode';
