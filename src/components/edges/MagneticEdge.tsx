import { BaseEdge, EdgeProps, getBezierPath, getStraightPath, getSmoothStepPath } from '@xyflow/react';

export function MagneticEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
    data, // Receive data
}: EdgeProps) {
    const pathType = data?.pathType || 'bezier';

    let edgePath = '';
    const params = {
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    };

    switch (pathType) {
        case 'straight':
            [edgePath] = getStraightPath(params);
            break;
        case 'step':
            // Fallback since getStepPath is not exported?
            // Or use smoothstep with 0 radius if that API existed. 
            // For now, mapping 'step' to 'smoothstep' visually.
            [edgePath] = getSmoothStepPath({ ...params, borderRadius: 0 });
            break;
        case 'smoothstep':
            [edgePath] = getSmoothStepPath(params); // Default radius
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
                    stroke: selected ? '#fff' : '#71717a', // zinc-500
                    ...style,
                }}
                className="react-flow__edge-path opacity-80"
            />

            {/* Flow Particle Animation */}
            {/* We render a duplicate path just for the animation mask or direct stroke-dasharray animation */}
            {(data?.animate !== false) && (
                <BaseEdge
                    path={edgePath}
                    style={{
                        strokeWidth: 2,
                        stroke: '#fbbf24', // Amber-400 (Energy Flow)
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
