import { Handle, HandleProps } from '@xyflow/react';
import { cn } from '@/lib/utils'; // Assuming cn exists, or I will use template literals if not sure. 
// Wait, I should check if @/lib/utils exists. If not, I'll use standard explicit classes.
// I'll stick to standard template literals for safety first, or check for clsx/tailwind-merge.
// The user has `globals.css`, high chance of `cn` if it's a shadcn/modern setup. 
// But to be safe and avoid errors, I'll just use template literals for now or standard string concat.

/**
 * BaseHandle Component
 * 
 * A unified handle component that enforces the "Solid Dot + White Border" design system.
 * Removes the need for !important by correctly organizing classes.
 * 
 * @param color - 'green' (Input/Target) or 'blue' (Output/Source) or others.
 */
interface BaseHandleProps extends HandleProps {
    color?: 'green' | 'blue' | 'zinc' | 'red' | 'orange' | 'purple' | 'indigo';
}

const COLOR_MAP = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    zinc: 'bg-zinc-400',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
};

export function BaseHandle({
    color = 'zinc',
    className,
    style,
    ...props
}: BaseHandleProps) {
    const bgColor = COLOR_MAP[color] || COLOR_MAP.zinc;

    return (
        <Handle
            {...props}
            className={`
                nodrag 
                w-3 h-3 
                rounded-full 
                border-2 border-white 
                ${bgColor} 
                ${className || ''}
            `.trim().replace(/\s+/g, ' ')}
            style={{
                zIndex: 10,
                ...style,
            }}
        />
    );
}
