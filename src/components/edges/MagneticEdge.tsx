import { BaseEdge, EdgeProps, getBezierPath, getStraightPath, getSmoothStepPath, useStore } from '@xyflow/react';
import React, { useContext, useRef } from 'react';
import { useCapsulePreview } from './capsulePreviewState';
import { HANDLE_SLOT_SPACING, calculateSlotOffsetY } from '../../utils/handleUtils';
import { RelinkContext } from './RelinkLine';

export function MagneticEdge({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    targetHandleId,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
    data, // Receive data
}: EdgeProps) {
    const pathType = data?.pathType || 'bezier';
    const { startEdgeDragDisconnect } = useContext(RelinkContext);
    const dragStartPos = useRef<{ x: number, y: number } | null>(null);

    // ─── Dynamic Target Y Offset Calculation ───
    const allEdges = useStore((s) => s.edges);
    const siblingEdges = allEdges.filter((e) => e.target === target && e.targetHandle === targetHandleId);
    const preview = useCapsulePreview(); // Must be at top level (React rules of hooks)

    let finalTargetY = targetY;
    if (siblingEdges.length > 0) {
        const myIndex = siblingEdges.findIndex((e) => e.id === id);
        if (myIndex !== -1) {
            const isPreviewActive = preview.active && preview.nodeId === target && preview.handleId === targetHandleId;
            // CHECK: Is the previewed wire already committed to the edge list?
            const isAlreadyCommitted = isPreviewActive && siblingEdges.length === preview.totalSlots;

            if (isPreviewActive && !isAlreadyCommitted) {
                // A new wire is pending at preview.slotIndex — shift existing wires to make room
                const total = preview.totalSlots;
                const adjustedIndex = myIndex >= preview.slotIndex ? myIndex + 1 : myIndex;
                finalTargetY += calculateSlotOffsetY(adjustedIndex, total);
            } else {
                // Normal layout or post-drop transition
                finalTargetY += calculateSlotOffsetY(myIndex, siblingEdges.length);
            }
        }
    }

    let edgePath = '';
    const params = {
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY: finalTargetY,
        targetPosition,
    };

    switch (pathType) {
        case 'straight':
            [edgePath] = getStraightPath(params);
            break;
        case 'step':
            [edgePath] = getSmoothStepPath({ ...params, borderRadius: 0 });
            break;
        case 'smoothstep':
            [edgePath] = getSmoothStepPath(params);
            break;
        default:
            [edgePath] = getBezierPath(params);
            break;
    }

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
                    strokeWidth: selected ? 3 : 2,
                    stroke: selected ? '#fff' : '#71717a',
                    ...style,
                }}
                className="react-flow__edge-path opacity-80"
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
