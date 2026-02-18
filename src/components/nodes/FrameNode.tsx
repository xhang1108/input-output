'use client';

import { memo, useCallback } from 'react';
import { NodeProps, NodeResizer } from '@xyflow/react';
import { Brain } from '@/engine/Brain';

/**
 * FrameNode (UI-02) — Visual grouping container.
 * Pure structural node: no handles, no logic, no computation.
 * NodeResizer handles dimensions via React Flow's internal style management.
 */
export const FrameNode = memo(({ id, data, selected }: NodeProps) => {
    const label = String(data.label || 'Frame');

    return (
        <div className="frame-node" data-selected={selected}>
            {/* Manual resizing disabled in favor of Content-Aware Auto-Resize */}
            <div className="frame-node__label">{label}</div>
        </div>
    );
});

FrameNode.displayName = 'FrameNode';
