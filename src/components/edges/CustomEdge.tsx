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
    source,
    target,
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
    const sourceNode = getNode(source);

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
