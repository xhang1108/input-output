'use client';

import { memo } from 'react';

interface ResultPreviewProps {
    result: any;
    error?: string | null;
    className?: string;
    precision?: number;
}

export const ResultPreview = memo(({ result, error, className = "", precision = 2 }: ResultPreviewProps) => {
    if (error) {
        return (
            <div className={`mt-2 pt-2 border-t flex justify-center border-red-100 ${className}`}>
                <span className="text-red-500 text-xs font-bold">⚠️ {error}</span>
            </div>
        );
    }

    const displayContent = (() => {
        if (result === null || result === undefined) return '...';

        // Matrix/Array Detection
        const isMatrix = result && (result.isMatrix || Array.isArray(result));
        if (isMatrix) {
            const clean = result.toArray ? result.toArray() : result;
            if (Array.isArray(clean) && Array.isArray(clean[0])) {
                return `${clean.length}×${clean[0].length}`;
            }
            return `[${clean.length}]`;
        }

        // Numeric Formatting
        if (typeof result === 'number' && !isNaN(result)) {
            // Check if it's very small but non-zero
            if (Math.abs(result) < (1 / Math.pow(10, precision)) && result !== 0) {
                return result.toExponential(2);
            }

            return result.toLocaleString('en-US', {
                maximumFractionDigits: precision,
                useGrouping: true
            });
        }

        // Fallback for strings or other types
        return String(result).slice(0, 10);
    })();

    return (
        <div className={`flex justify-center ${className}`}>
            <span className="text-zinc-600 font-mono font-bold text-sm">
                {displayContent}
            </span>
        </div>
    );
});

ResultPreview.displayName = 'ResultPreview';
