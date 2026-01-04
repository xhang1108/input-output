'use client';

import {
    BaseEdge,
    getBezierPath,
    useReactFlow,
    type EdgeProps,
} from '@xyflow/react';
import { useMemo } from 'react';

export function CustomEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
}: EdgeProps) {
    const { getNode } = useReactFlow();

    // 1. Calculate Path
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    // 3. Determine Flow Type (Formula vs Value)
    // We get the source node to see if it's carrying a raw expression formula
    // Note: arguments[0].source is the safest way to get the source ID from EdgeProps in some versions,
    // but here we can just parse the ID or use the internal node lookup.

    // Attempt to get source node ID from the edge ID (standard React Flow behavior) or props
    // Edge IDs are typically "source->target" or "xy-edge__source-target"
    const sourceId = id.split('->')[0] || id.split('__')[1]?.split('-')[0];
    const sourceNode = getNode(sourceId);

    const isFormula = useMemo(() => {
        if (!sourceNode) return false;

        const data = sourceNode.data as { rawExpression?: string, value?: number };
        const expr = data.rawExpression || '';

        // Heuristic: It's a formula if it contains letters (variables) or is a long expression
        return /[a-df-z]/i.test(expr) || expr.length > 5;
    }, [sourceNode]);

    // 4. Dynamic Styles
    const edgeStyle = {
        ...style,
        stroke: isFormula ? '#a855f7' : '#71717a', // Purple for formula, Zinc for value
        strokeWidth: isFormula ? 3 : 2,
        strokeDasharray: isFormula ? '5 5' : undefined,
        // Animation is handled by class
    };

    return (
        <BaseEdge
            path={edgePath}
            markerEnd={markerEnd}
            style={edgeStyle}
            className={isFormula ? "animate-pulse" : ""}
        />
    );
}
