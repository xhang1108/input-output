import { forwardRef } from 'react';
import { Handle, HandleProps, Position } from '@xyflow/react';

interface SourceHandleProps extends Omit<HandleProps, 'type' | 'position'> {
    color?: 'green' | 'blue' | 'zinc' | 'red' | 'orange' | 'purple' | 'indigo';
    position?: Position;
}

const COLOR_MAP = {
    green: 'bg-green-500!',
    blue: 'bg-blue-500!',
    zinc: 'bg-zinc-400!',
    red: 'bg-red-500!',
    orange: 'bg-orange-500!',
    purple: 'bg-purple-500!',
    indigo: 'bg-indigo-500!',
};

export const SourceHandle = forwardRef<HTMLDivElement, SourceHandleProps>(
    ({ color = 'blue', id, className, style, position = Position.Right, ...props }, ref) => {
        const bgColor = COLOR_MAP[color] || COLOR_MAP.blue;

        return (
            <Handle
                {...props}
                ref={ref}
                id={id}
                type="source"
                position={position}
                className={`
                    nodrag 
                    w-3! h-3! 
                    rounded-full! 
                    border-2! border-white! 
                    ${bgColor} 
                    right-0!
                    ${className || ''}
                `.trim().replace(/\s+/g, ' ')}
                style={{
                    zIndex: 10,
                    ...style,
                }}
            />
        );
    }
);

SourceHandle.displayName = 'SourceHandle';
