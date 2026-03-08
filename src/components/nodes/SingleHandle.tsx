import { memo, useEffect } from 'react';
import { Position, useUpdateNodeInternals } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NodeHandle } from './NodeHandle';
import { HandleConfig, getHandleColor, resolveHandlePosition } from '../../types/NodeDefinition';

interface SingleHandleProps {
    h: HandleConfig;
    id: string;
    isConnectable: boolean;
    nodeData?: any;
}

export const SingleHandle = memo(({ h, id, isConnectable, nodeData }: SingleHandleProps) => {
    const isManual = h.y !== undefined;
    const dynamicHeight = 12;
    const updateNodeInternals = useUpdateNodeInternals();

    // Standardize source-level layout update for all handle variants
    useEffect(() => {
        updateNodeInternals(id);
        return () => updateNodeInternals(id);
    }, [id, updateNodeInternals]);

    return (
        <div
            className={cn(
                "relative flex items-center justify-center",
                isManual && "absolute translate-y--1/2"
            )}
            style={isManual ? { top: typeof h.y === 'number' ? `${h.y}px` : h.y } : undefined}
        >
            <NodeHandle
                type={h.type}
                position={resolveHandlePosition(h)}
                id={h.id}
                nodeId={id}
                className="z-50 pointer-events-auto origin-center w-(--handle-size-sm)! h-(--handle-size-sm)!"
                color={h.dynamicColor ? getHandleColor({ ...h, dataType: h.dynamicColor(nodeData) }) : getHandleColor(h)}
                isConnectable={isConnectable}
            />

            {/* Placeholder for the handle's space in the flex column (only if NOT manual) */}
            {!isManual && (
                <div
                    style={{
                        width: '1px',
                        height: `${dynamicHeight}px`
                    }}
                />
            )}
        </div>
    );
});

SingleHandle.displayName = 'SingleHandle';
