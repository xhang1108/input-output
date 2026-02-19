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
        <div className="frame-node" data-selected={selected} style={{ pointerEvents: 'none' }}>
            {/* Manual resizing disabled in favor of Content-Aware Auto-Resize */}
            <div className="frame-node__label" style={{ pointerEvents: 'auto', cursor: 'grab' }}>{label}</div>

            {/* Interactive Border Regions (20px) */}
            {/* Top */}<div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20, pointerEvents: 'auto', cursor: 'grab', zIndex: 1 }} />
            {/* Bottom */}<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 20, pointerEvents: 'auto', cursor: 'grab', zIndex: 1 }} />
            {/* Left */}<div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 20, pointerEvents: 'auto', cursor: 'grab', zIndex: 1 }} />
            {/* Right */}<div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 20, pointerEvents: 'auto', cursor: 'grab', zIndex: 1 }} />
        </div>
    );
});

FrameNode.displayName = 'FrameNode';
