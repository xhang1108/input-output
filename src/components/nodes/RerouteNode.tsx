import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

export const RerouteNode = memo(({ selected }: NodeProps) => {
    return (
        <div
            className={`
                relative w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200
                ${selected ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)] scale-125' : 'bg-zinc-500 hover:bg-zinc-400'}
            `}
        >
            {/* Input Handle (Left) - Invisible but clickable */}
            <Handle
                type="target"
                position={Position.Left}
                id="in"
                className="w-full h-full opacity-0 bg-transparent! rounded-full border-none"
                isConnectable={true}
            />

            {/* Output Handle (Right) - Invisible but sourceable */}
            <Handle
                type="source"
                position={Position.Right}
                id="out"
                className="w-full h-full opacity-0 bg-transparent! rounded-full border-none"
                isConnectable={true}
            />
        </div>
    );
});

RerouteNode.displayName = 'RerouteNode';
