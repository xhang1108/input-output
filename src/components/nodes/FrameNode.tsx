'use client';

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';

/**
 * Frame (UI-02) — visual grouping container.
 * No handles, no logic, no computation. Children are real React Flow children
 * with parent-relative positions; moving the frame moves them with it.
 */
export const FrameNode = memo(({ data, selected }: NodeProps) => {
    const label = String(data?.label || 'Frame');

    return (
        <div className="frame-node" data-selected={selected ? 'true' : 'false'}>
            <div className="frame-node__label">{label}</div>
        </div>
    );
});

FrameNode.displayName = 'FrameNode';
