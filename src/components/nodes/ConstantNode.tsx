'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { BaseNode, HandleConfig } from './BaseNode';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { NodeOpSelect } from './NodeOpSelect';
import { CategorizedMenuItem } from '../ui/CategorizedMenu';

const HANDLES: HandleConfig[] = [
    { id: 'out_a', type: 'source', position: Position.Right, variant: 'single', dataType: 'scalar' }
];

export const ConstantNode = memo((props: NodeProps) => {
    const { id, data } = props;
    
    const nodeData = useMemo(() => ({
        ...data,
        handles: HANDLES
    }), [data]);

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-1 w-full min-w-[100px]">
                <NodeOpSelect
                    nodeId={id}
                    defId="IN-06"
                    paramId="val"
                    data={data}
                    label=""
                    width="36"
                />
                <NodeOpSelect
                    nodeId={id}
                    defId="IN-06"
                    paramId="precision"
                    data={data}
                    label="Accuracy"
                    width="32"
                />
            </div>
        </BaseNode>
    );
});
ConstantNode.displayName = 'ConstantNode';

