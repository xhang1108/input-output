'use client';

import { memo, useCallback, useRef } from 'react';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { ResizeHandle } from './ResizeHandle';
import type { ResizeDimensions } from './hooks/useFlexibleResize';
import { useBrain } from '../../context/BrainContext';
import { useHistoryStore } from '../../store/useHistoryStore';
import { getFrameMinSize } from '../../utils/frameGeometry';

const MIN_FRAME_WIDTH = 200;
const MIN_FRAME_HEIGHT = 120;

/**
 * Frame (UI-02) — visual grouping container.
 * No handles, no logic. Children are real React Flow children with
 * parent-relative positions; resizing keeps the top-left fixed and cannot
 * shrink below the content bounds.
 */
export const FrameNode = memo(({ id, data, selected }: NodeProps) => {
    const { getNodes, setNodes } = useReactFlow();
    const brain = useBrain();
    const pushHistory = useHistoryStore(s => s.push);

    const rootRef = useRef<HTMLDivElement>(null);
    const startSize = useRef<{ w: number; h: number } | null>(null);
    const minSize = useRef<{ w: number; h: number }>({ w: MIN_FRAME_WIDTH, h: MIN_FRAME_HEIGHT });
    const currentSize = useRef<{ w: number; h: number } | null>(null);

    const label = String(data?.label || 'Frame');

    const clamp = (dims: ResizeDimensions) => ({
        w: Math.max(minSize.current.w, Math.round(dims.screenW)),
        h: Math.max(minSize.current.h, Math.round(dims.screenH)),
    });

    const applySize = useCallback((w: number, h: number) => {
        currentSize.current = { w, h };
        setNodes(nds => nds.map(n => (
            n.id === id
                ? { ...n, width: w, height: h, data: { ...n.data, width: w, height: h } }
                : n
        )));
    }, [id, setNodes]);

    const onResizeStart = useCallback(() => {
        const nodes = getNodes();
        const frame = nodes.find(n => n.id === id);
        if (!frame) return;
        startSize.current = {
            w: frame.width ?? frame.measured?.width ?? MIN_FRAME_WIDTH,
            h: frame.height ?? frame.measured?.height ?? MIN_FRAME_HEIGHT,
        };
        minSize.current = getFrameMinSize(nodes, id, MIN_FRAME_WIDTH, MIN_FRAME_HEIGHT);
    }, [getNodes, id]);

    const onResize = useCallback((dims: ResizeDimensions) => {
        const { w, h } = clamp(dims);
        applySize(w, h);
    }, [applySize]);

    const onResizeEnd = useCallback((dims: ResizeDimensions) => {
        const { w, h } = clamp(dims);
        const before = startSize.current;

        if (before && (w !== before.w || h !== before.h)) {
            const forward = [{ type: 'RESIZE_NODE' as const, payload: { id, width: w, height: h } }];
            const inverse = [{ type: 'RESIZE_NODE' as const, payload: { id, width: before.w, height: before.h } }];

            brain.applyTransaction({ type: 'BATCH', payload: forward }, true);
            pushHistory({
                id: `frame_resize_${Date.now()}`,
                description: 'Resize Frame',
                forward,
                inverse,
            });
        }

        startSize.current = null;
        minSize.current = { w: MIN_FRAME_WIDTH, h: MIN_FRAME_HEIGHT };
    }, [brain, id, pushHistory]);

    return (
        <div ref={rootRef} className="frame-node group" data-selected={selected ? 'true' : 'false'}>
            <div className="frame-node__label">{label}</div>
            {/* Border hit areas: the interior stays transparent to the pane so a
                marquee can start inside the frame to select its children. */}
            <div className="frame-node__hit frame-node__hit--top" />
            <div className="frame-node__hit frame-node__hit--right" />
            <div className="frame-node__hit frame-node__hit--bottom" />
            <div className="frame-node__hit frame-node__hit--left" />

            <ResizeHandle
                id={id}
                targetRef={rootRef}
                position="bottom-right"
                className="pointer-events-auto nodrag"
                onResize={onResize}
                onResizeStart={onResizeStart}
                onResizeEnd={onResizeEnd}
            />
        </div>
    );
});

FrameNode.displayName = 'FrameNode';
