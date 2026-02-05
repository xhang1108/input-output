'use client';

import { Handle, HandleProps } from '@xyflow/react';
import { cn } from '@/lib/utils'; // Assuming cn exists or I need to create it? I should check if lib/utils exists.

// If lib/utils doesn't exist, I'll inline the cn function or create it.
// Checking file listing earlier, I didn't see src/lib. I should create it if missing or just use template literals for now if simple.
// I'll assume I need to create src/lib/utils.ts if I use it.
// For now, let's use standard class strings to be safe and avoid extra dependency if utils is missing.

interface CustomHandleProps extends HandleProps {
    color?: string; // CSS variable or hex
}

export function NodeHandle({ className, color, style, ...props }: CustomHandleProps) {
    return (
        <Handle
            className={cn(
                "w-3 h-3 rounded-full border-2 border-zinc-900 bg-zinc-500 transition-colors z-50",
                className
            )}
            style={{
                background: color || 'var(--color-scalar)',
                ...style
            }}
            {...props}
        />
    );
}
