import { cn, getRelativePosition } from '@/lib/utils';
import { type ReactNode, forwardRef } from 'react';

interface NodeShellProps {
    children: ReactNode;
    selected?: boolean;
    className?: string; // For passing specific colors/shapes/hover effects
}

export const NodeShell = forwardRef<HTMLDivElement, NodeShellProps>(({ children, selected, className }, ref) => {
    return (
        <div
            ref={ref}
            className={cn(
                // Base logic: Merge incoming className first, then apply selection ring
                // We use 'group' here so children can use group-hover if needed
                "group relative min-w-[140px] min-h-[40px] flex flex-col",
                className,
                // The critical fix: Always apply ring if selected
                selected && "ring-2 ring-blue-500 ring-offset-2"
            )}>
            {children}
        </div>
    );
});

NodeShell.displayName = 'NodeShell';
