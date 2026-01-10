'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

interface BooleanPreviewProps {
    value: boolean | null;
    error?: string | null;
    className?: string;
}

export const BooleanPreview = memo(({ value, error, className }: BooleanPreviewProps) => {
    if (error) return null;

    const isTrue = value === true;
    const isFalse = value === false;
    const isNeutral = value === null;

    return (
        <div className={cn("flex items-center justify-end px-2", className)}>
            <span
                className={cn(
                    "font-mono text-lg font-bold transition-all duration-300",
                    isTrue ? "text-indigo-600 scale-110" : "text-zinc-400 scale-100",
                    isNeutral && "opacity-20"
                )}
            >
                {isTrue ? 'TRUE' : isFalse ? 'FALSE' : '-'}
            </span>
        </div>
    );
});

BooleanPreview.displayName = 'BooleanPreview';
