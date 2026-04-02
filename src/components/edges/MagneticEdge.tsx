import { BaseEdge, EdgeProps, getBezierPath, useStore } from '@xyflow/react';
import React, { useContext, useRef } from 'react';
import { useCapsulePreview } from './capsulePreviewState';
import { HANDLE_SLOT_SPACING, calculateSlotOffsetY } from '../../utils/handleUtils';
import { RelinkContext } from './RelinkLine';
import { useAppStore } from '../../store/useStore';

export function MagneticEdge({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    targetHandleId,
    sourceHandleId,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
    data,
}: EdgeProps) {
    // pathType is now consistently 'bezier'
    const { startEdgeDragDisconnect } = useContext(RelinkContext);
    const dragStartPos = useRef<{ x: number, y: number } | null>(null);

    const siblingEdgesCount = useStore((s) => s.edges.filter((e) => e.target === target && e.targetHandle === targetHandleId).length);
    const myIndex = useStore((s) => s.edges.filter((e) => e.target === target && e.targetHandle === targetHandleId).findIndex((e) => e.id === id));
    
    const highlightedEdgeId = useAppStore(s => s.highlightedEdgeId);
    const isHighlighted = highlightedEdgeId === id;
    const preview = useCapsulePreview();

    // Selection Tracking: Link edge highlight to connected nodes
    const isSourceSelected = useStore(s => s.nodeLookup.get(source)?.selected);
    const isTargetSelected = useStore(s => s.nodeLookup.get(target)?.selected);
    const effectivelySelected = selected || isSourceSelected || isTargetSelected;

    let finalTargetY = targetY;
    if (siblingEdgesCount > 0 && myIndex !== -1) {
        const isPreviewActive = preview.active && preview.nodeId === target && preview.handleId === targetHandleId;
        // CHECK: Is the previewed wire already committed to the edge list?
        const isAlreadyCommitted = isPreviewActive && siblingEdgesCount === preview.totalSlots;

        if (isPreviewActive && !isAlreadyCommitted) {
            // A new wire is pending at preview.slotIndex — shift existing wires to make room
            const total = preview.totalSlots;
            const adjustedIndex = myIndex >= preview.slotIndex ? myIndex + 1 : myIndex;
            finalTargetY += calculateSlotOffsetY(adjustedIndex, total);
        } else {
            // Normal layout or post-drop transition
            finalTargetY += calculateSlotOffsetY(myIndex, siblingEdgesCount);
        }
    }

    // --- Dynamic Edge Alignment ---
    // React Flow 11+ natively calculates sourceX/Y and targetX/Y at the exact boundary
    // edge of the handle bounding box. Any manual offset here would duplicate that push.
    const params = {
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY: finalTargetY,
        targetPosition,
    };

    const [edgePath] = getBezierPath(params);

    return (
        <>
            {/* Glow / Hover Hit Area - Invisible fat line for easier selection */}
            <BaseEdge
                path={edgePath}
                style={{ strokeWidth: 20, stroke: 'transparent' }}
                className="react-flow__edge-interaction"
            />


            {/* The Actual Edge */}
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    strokeWidth: isHighlighted ? 4 : (effectivelySelected ? 3 : 2),
                    stroke: isHighlighted ? 'var(--color-primary)' : (effectivelySelected ? '#fff' : 'var(--color-zinc-500)'),
                    ...style,
                }}
                className={`react-flow__edge-path opacity-80 ${isHighlighted ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : ''}`}
            />

            {/* Drag-to-Disconnect Hit Area (Invisible/Secret) */}
            {startEdgeDragDisconnect && (
                <circle
                    cx={targetX}
                    cy={finalTargetY}
                    r={12}
                    fill="transparent"
                    className="relative z-50 pointer-events-auto"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        dragStartPos.current = { x: e.clientX, y: e.clientY };
                    }}
                    onPointerMove={(e) => {
                        if (!dragStartPos.current) return;
                        const dx = e.clientX - dragStartPos.current.x;
                        const dy = e.clientY - dragStartPos.current.y;
                        // If moved more than 5 pixels, consider it a drag
                        if (Math.hypot(dx, dy) > 5) {
                            dragStartPos.current = null;
                            e.currentTarget.releasePointerCapture(e.pointerId);
                            startEdgeDragDisconnect(e, id);
                        }
                    }}
                    onPointerUp={(e) => {
                        dragStartPos.current = null;
                        e.currentTarget.releasePointerCapture(e.pointerId);
                    }}
                    onPointerCancel={(e) => {
                        dragStartPos.current = null;
                        e.currentTarget.releasePointerCapture(e.pointerId);
                    }}
                />
            )}
        </>
    );
}
