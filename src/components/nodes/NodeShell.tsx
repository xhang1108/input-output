import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

interface NodeShellProps {
    children: ReactNode;
    selected?: boolean;
    className?: string; // For passing specific colors/shapes/hover effects
}

export function NodeShell({ children, selected, className }: NodeShellProps) {
    return (
        <div className={cn(
            // Base logic: Merge incoming className first, then apply selection ring
            // We use 'group' here so children can use group-hover if needed
            "group",
            className,
            // The critical fix: Always apply ring if selected
            selected && "ring-2 ring-blue-500 ring-offset-2"
        )}>
            {children}
        </div>
    );
}
