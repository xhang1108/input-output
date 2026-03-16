
import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { NodeOpSelect } from './NodeOpSelect';

// Explicit map: which ops produce scalar vs boolean output
const NT_OP_OUTPUT: Record<string, 'scalar' | 'boolean'> = {
    IS_PRIME: 'boolean', // Test → bool
    GCD: 'scalar',  // Result → number
    LCM: 'scalar',  // Result → number
    MOD: 'scalar',  // Result → number
};

export const NumberTheoryNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const op = (data.op as string) || 'GCD';

    // Dynamic handles
    const handles = [
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'A' },
        { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar', label: 'B' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: NT_OP_OUTPUT[op] ?? 'scalar' }
    ];

    const nodeData = { ...data, handles };
    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1.5 p-1 min-w-[140px]">
                <NodeOpSelect
                    nodeId={id}
                    defId="MA-07"
                    paramId="op"
                    data={data}
                    label="Operation"
                    width="48"
                />
            </div>
        </BaseNode>
    );
});
NumberTheoryNode.displayName = 'NumberTheoryNode';
