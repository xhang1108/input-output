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

            {/* Output Handle - Right half (50%).
                Raw <Handle> (bypasses BaseNode/SingleHandle): ids are static
                ('out_a'/'in_a', unique by construction); P2-11 exempts this
                node from the dev-only uniqueness assert by design. */}
            <Handle
                type="source"
                position={Position.Right}
                id="out_a"
                className="opacity-0 border-none! bg-transparent!"
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '50%',
                    height: '100%',
                    transform: 'none',
                    zIndex: 100,
                    margin: 0,
                    borderRadius: '0 9999px 9999px 0'
                }}
            />

            {/* Input Handle - Left half (50%).
                Raw <Handle> (bypasses BaseNode/SingleHandle): see note above. */}
            <Handle
                type="target"
                position={Position.Left}
                id="in_a"
                className="opacity-0 border-none! bg-transparent!"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '50%',
                    height: '100%',
                    transform: 'none',
                    zIndex: 100,
                    margin: 0,
                    borderRadius: '9999px 0 0 9999px'
                }}
                isConnectableStart={true}
            />
        </div>
    );
});

RerouteNode.displayName = 'RerouteNode';

