
import { memo, useCallback, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { Brain } from '../../engine/Brain';

export const LogicNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const [op, setOp] = useState<string>((data.op as string) || 'AND');
    const { updateNodeData } = useReactFlow();

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newOp = e.target.value;
        const newLabel = e.target.options[e.target.selectedIndex].text.split(' ')[0];
        setOp(newOp);

        // Update both UI and Brain
        updateNodeData(id, { op: newOp, label: newLabel });
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { op: newOp, label: newLabel }
            }
        });
    }, [id, updateNodeData]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Operation</label>
                <select
                    className="nodrag w-full border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:border-orange-500 outline-none appearance-none"
                    style={{ background: 'var(--node-bg)' }}
                    value={op}
                    onChange={handleChange}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <optgroup label="Boolean Gates">
                        <option value="AND">AND (&&)</option>
                        <option value="OR">OR (||)</option>
                        <option value="NOT">NOT (!)</option>
                        <option value="XOR">XOR (⊕)</option>
                    </optgroup>
                    <optgroup label="Comparisons">
                        <option value="EQ">Equal (==)</option>
                        <option value="NEQ">Not Equal (!=)</option>
                        <option value="GT">Greater Than (&gt;)</option>
                        <option value="LT">Less Than (&lt;)</option>
                        <option value="GTE">Greater or Equal (&gt;=)</option>
                        <option value="LTE">Less or Equal (&lt;=)</option>
                    </optgroup>
                </select>
            </div>
        </BaseNode>
    );
});

LogicNode.displayName = 'LogicNode';
