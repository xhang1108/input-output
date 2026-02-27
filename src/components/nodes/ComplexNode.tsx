import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

// Helper to generate handles based on mode
const getHandlesForMode = (mode: string) => {
    if (mode === 'combine_cartesian') {
        return [
            { id: 'in_re', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Re' },
            { id: 'in_im', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Im' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'any', label: 'Out' }
        ];
    } else if (mode === 'combine_polar') {
        return [
            { id: 'in_abs', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Abs(r)' },
            { id: 'in_arg', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'Arg(φ)' },
            { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'any', label: 'Out' }
        ];
    }
    // Default: 'separate'
    return [
        { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'any', label: 'In' },
        { id: 're', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Re' },
        { id: 'im', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Im' },
        { id: 'abs', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Abs(r)' },
        { id: 'arg', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar', label: 'Arg(φ)' }
    ];
};

export const ComplexNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const mode = (data.mode as string) || 'separate';

    const handleModeChange = useCallback((newMode: string) => {
        if (newMode === mode) return;
        const newHandles = getHandlesForMode(newMode);

        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: {
                    mode: newMode,
                    handles: newHandles
                }
            }
        });
    }, [id, mode]);

    const handles = getHandlesForMode(mode);
    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-1 min-w-[140px] nodrag" onMouseDown={(e) => e.stopPropagation()}>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Mode</label>
                <div className="flex bg-black/40 rounded-lg p-0.5 border border-zinc-700/50">
                    <button
                        className={`flex-1 text-[10px] py-1 px-1.5 rounded-md transition-all duration-200 ${mode === 'separate' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        onClick={() => handleModeChange('separate')}
                    >
                        Extract
                    </button>
                    <button
                        className={`flex-1 text-[10px] py-1 px-1.5 rounded-md transition-all duration-200 ${mode === 'combine_cartesian' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        onClick={() => handleModeChange('combine_cartesian')}
                    >
                        a + bi
                    </button>
                    <button
                        className={`flex-1 text-[10px] py-1 px-1.5 rounded-md transition-all duration-200 ${mode === 'combine_polar' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                        onClick={() => handleModeChange('combine_polar')}
                    >
                        r∠φ
                    </button>
                </div>
            </div>
        </BaseNode>
    );
});
ComplexNode.displayName = 'ComplexNode';
