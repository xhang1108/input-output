import { memo } from 'react';
import { Position, NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { CapsuleHandle } from './CapsuleHandle';

export const BridgeNode = memo((props: NodeProps) => {
    const { id, isConnectable } = props;
    const brain = useBrain();
    const logic = brain.getNode(id);
    const isInput = logic?.type === 'BRIDGE_IN';

    // Fallback if data is missing
    const handles = (logic?.data?.handles as Array<{ id: string, type: string }>) || [];

    return (
        <BaseNode {...props}>
            <div style={{
                padding: '12px',
                minWidth: '160px',
                minHeight: '40px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '10px',
                fontStyle: 'italic'
            }}>
                {isInput ? 'Macro data entry points' : 'Macro data exit points'}
            </div>
        </BaseNode>
    );
});

