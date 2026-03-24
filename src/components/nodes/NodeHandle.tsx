'use client';

import { Handle, HandleProps, useUpdateNodeInternals } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { isGenericColor } from '../../utils/handleUtils';

interface CustomHandleProps extends HandleProps {
    color?: string; // CSS variable or hex
    id: string;
    nodeId: string;
    maxConnections?: number;
}

/**
 * NodeHandle - Performance-optimized custom handle.
 * Robust implementation for consistent color rendering.
 */
export function NodeHandle({ className, color, id, nodeId, maxConnections, ...props }: CustomHandleProps) {
    const updateNodeInternals = useUpdateNodeInternals();

    useEffect(() => {
        updateNodeInternals(nodeId);
        return () => updateNodeInternals(nodeId);
    }, [nodeId, updateNodeInternals]);

    const isPending = id.endsWith('_pending');
    const normalizedColor = String(color || '').trim().toLowerCase();

    // Symbolic detection: Equation Solver (CL-04) or symbolic keywords
    const isSymbolic =
        (nodeId || '').includes('CL-04') ||
        normalizedColor.includes('symbolic') ||
        normalizedColor === 'var(--color-symbolic)' ||
        normalizedColor.includes('formula') ||
        normalizedColor.includes('eq');

    const isWhite = isGenericColor(normalizedColor);

    return (
        <Handle
            id={id}
            // Use data-handle-type for CSS-level !important overrides in globals.css
            data-handle-type={isSymbolic ? 'symbolic' : (isWhite ? 'any' : undefined)}
            className={cn(
                "z-50 pointer-events-auto origin-center w-(--handle-size-sm)! rounded-full border-2 border-zinc-900 transition-colors",
                isPending && "border-dashed opacity-100 border-zinc-300! bg-transparent!",
                isWhite && "shadow-(--glow-any)!",
                className
            )}
            style={{
                // Base background color, overridden by [data-handle-type] in CSS if symbolic
                backgroundColor: isPending ? 'transparent' : (isSymbolic ? 'var(--color-symbolic)' : (isWhite ? 'var(--color-any)' : (color || 'var(--color-scalar)'))),
                ...props.style
            }}
            {...props}
        />
    );
}
