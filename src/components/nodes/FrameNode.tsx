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
            {/* Border hit areas: the interior stays transparent to the pane so a
                marquee can start inside the frame to select its children. */}
            <div className="frame-node__hit frame-node__hit--top" />
            <div className="frame-node__hit frame-node__hit--right" />
            <div className="frame-node__hit frame-node__hit--bottom" />
            <div className="frame-node__hit frame-node__hit--left" />
        </div>
    );
});

FrameNode.displayName = 'FrameNode';
