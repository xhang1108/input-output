import { memo, useCallback, useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const ToggleNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

    const unwrapped = PayloadUtils.unwrap(data.value);
    const [localActive, setLocalActive] = useState(!!unwrapped);

    // Sync from parent
    useEffect(() => {
        setLocalActive(!!unwrapped);
    }, [unwrapped]);

    const handles = [
        { id: 'out', type: 'source', position: 'right', variant: 'single', dataType: 'boolean' }
    ];

    const nodeData = { ...data, handles };

    const handleToggle = useCallback(() => {
        const next = !localActive;
        setLocalActive(next);
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { value: next } }
        });
    }, [id, localActive, brain]);

    const isActive = localActive;

    return (
        <BaseNode {...props} data={nodeData}>
            <div 
                className="flex flex-col items-center gap-3 p-2 min-w-[80px]"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div
                    className={`
                        nodrag cursor-pointer w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out
                        ${isActive ? 'bg-orange-500' : 'bg-zinc-700'}
                    `}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleToggle();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div
                        className={`
                            w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-sm
                            ${isActive ? 'translate-x-6' : 'translate-x-0'}
                        `}
                    />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    {isActive ? 'ON' : 'OFF'}
                </span>
            </div>
        </BaseNode>
    );
});

ToggleNode.displayName = 'ToggleNode';
