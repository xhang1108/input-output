'use client';

import {
    BaseEdge,
    getBezierPath,
    useReactFlow,
    type EdgeProps,
} from '@xyflow/react';
import { memo, useMemo } from 'react';

export const CustomEdge = memo(({
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
}: EdgeProps) => {
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
    // Optimization: Removed dynamic node lookup during drag to improve performance.
    // The previous `getNode(source)` call on every frame was causing significant lag.
    // TODO: Pass 'isFormula' via edge.data from Body.tsx if needed.
    const isFormula = false;

    /*
    const sourceNode = getNode(source);
    const isFormula = useMemo(() => {
        if (!sourceNode) return false;
        const data = sourceNode.data as { rawExpression?: string, value?: number };
        const expr = data.rawExpression || '';
        return /[a-df-z]/i.test(expr) || expr.length > 5;
    }, [sourceNode]);
    */

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
});
