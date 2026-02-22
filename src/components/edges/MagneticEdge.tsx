import { BaseEdge, EdgeProps, getBezierPath, getStraightPath, getSmoothStepPath, useStore } from '@xyflow/react';
import { useCapsulePreview } from './capsulePreviewState';
import { HANDLE_SLOT_SPACING, calculateSlotOffsetY } from '../../utils/handleUtils';

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

            {/* Auto-Insert Highlight Glow */}
            {data?.isHighlighted && (
                <BaseEdge
                    path={edgePath}
                    style={{
                        strokeWidth: 6,
                        stroke: 'var(--color-scalar)', // Use scalar color for highlight
                        filter: 'blur(4px)',
                        opacity: 0.8,
                    }}
                    className="react-flow__edge-path animate-pulse"
                />
            )}

            {/* The Actual Edge */}
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    strokeWidth: data?.isHighlighted ? 3 : (selected ? 3 : 2),
                    stroke: data?.isHighlighted ? '#fff' : (selected ? '#fff' : '#71717a'), // White when highlighted
                    ...style,
                }}
                className="react-flow__edge-path opacity-80"
            />

            {/* Flow Particle Animation */}
            {/* We render a duplicate path just for the animation mask or direct stroke-dasharray animation */}
            {(data?.animate !== false && !data?.isHighlighted) && (
                <BaseEdge
                    path={edgePath}
                    style={{
                        strokeWidth: 2,
                        stroke: 'var(--color-scalar)', // Amber-400 (Energy Flow)
                        fill: 'none',
                        strokeDasharray: 10,
                        strokeDashoffset: 0,
                        opacity: selected || style.opacity ? 1 : 0.3,
                    }}
                    className="react-flow__edge-path animate-flow pointer-events-none"
                />
            )}
        </>
    );
}
