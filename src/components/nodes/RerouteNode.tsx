import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

export const RerouteNode = memo(({ selected }: NodeProps) => {
    return (
        <div
            className="w-4 h-4 flex items-center justify-center p-0 m-0"
        >
            {/* Visual Circle */}
            <div
                className={`
                    w-full h-full rounded-full transition-all duration-200
                    ${selected ? 'bg-amber-400 scale-125' : 'bg-zinc-500 hover:bg-zinc-400'}
                `}
            />

            {/* Output Handle - Dominant layer for pulling connections */}
            <Handle
                type="source"
                position={Position.Right}
                id="out"
                className="opacity-0 rounded-full border-none! bg-transparent!"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    transform: 'none',
                    zIndex: 100,
                    margin: 0
                }}
            />

            {/* Input Handle - Underlying layer for receiving connections */}
            <Handle
                type="target"
                position={Position.Left}
                id="in_a"
                className="opacity-0 rounded-full border-none! bg-transparent!"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    transform: 'none',
                    zIndex: 50,
                    margin: 0
                }}
                isConnectableStart={false}
            />
        </div>
    );
});

RerouteNode.displayName = 'RerouteNode';
