import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';


const UNITS = [
    // Length
    'm', 'cm', 'mm', 'km', 'ft', 'in',
    // Mass
    'kg', 'g', 'lb',
    // Time
    's', 'min', 'h',
    // Physics
    'N', 'J', 'W', 'Pa', 'V', 'A', 'C', 'degC', 'degF'
];

export const UnitNode = memo((props: NodeProps) => {
    const { id, data } = props;

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const unit = e.target.value;
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { unit }
            }
        });
    }, [id]);

    // Simplified UI: Only show the dropdown, hide the value


    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1">
                <div className="flex items-center justify-center">
                    <select
                        className="nodrag bg-zinc-800 text-zinc-200 text-xs border border-zinc-700 rounded px-1 py-0.5 outline-none focus:border-blue-500"
                        value={data.unit as string || 'm'}
                        onChange={handleChange}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {UNITS.map(u => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                    </select>
                </div>
            </div>
        </BaseNode>
    );
});
UnitNode.displayName = 'UnitNode';
