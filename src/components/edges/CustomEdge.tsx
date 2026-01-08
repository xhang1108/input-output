'use client';

import {
    BaseEdge,
    getSmoothStepPath,
    useReactFlow,
    useStore,
    Position,
    type EdgeProps,
    type ReactFlowState,
} from '@xyflow/react';
import { memo, useMemo, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';

export const CustomEdge = memo((props: EdgeProps) => {
    const {
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
        sourceHandleId,
        targetHandleId,
        data,
    } = props as any;

    // Efficiently select only the target node's data and type
    const targetNodeData = useStore(useCallback((s: ReactFlowState) => {
        const node = s.nodeLookup.get(target);
        return node ? { muted: node.data.muted, type: node.type } : null;
    }, [target]));

    const { getNode } = useReactFlow();

    // 1. Calculate Path
    const [edgePath] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 20,
    });

    // 3. Determine Flow Type (Formula vs Value)
    const { displayMode } = useAppStore();
    const isFormula = !!(data as any)?.isFormula;
    const showFormulaStyle = isFormula && displayMode === 'formula';

    // 3.1 Mute Logic: Dim edges that are NOT the pass-through on a muted node
    const isTargetMuted = !!targetNodeData?.muted;
    const targetNodeType = targetNodeData?.type;

    // Define primary pass-through handles (must match Brain.ts)
    const primaryHandles: Record<string, string> = {
        'mathNode': 'inputA',
        'unaryNode': 'inputA',
        'logicNode': 'inputA',
        'compareNode': 'inputA',
        'switchNode': 'ifFalse',
        'outputNode': 'inputA',
        'solverNode': 'inputA',
    };

    // Correctly identify if this edge is connected to a non-primary handle on a muted node
    const isIgnored = isTargetMuted && targetHandleId !== primaryHandles[targetNodeType || ''];

    // 4. Dynamic Styles
    const edgeStyle = useMemo(() => ({
        ...style,
        stroke: isIgnored ? '#d4d4d8' : (showFormulaStyle ? '#a855f7' : '#71717a'),
        strokeWidth: showFormulaStyle ? 3 : 2,
        strokeDasharray: (showFormulaStyle && !isIgnored) ? '5 5' : undefined,
        opacity: isIgnored ? 0.3 : 1,
        // Desynchronize overlapping dashed lines
        animationDelay: showFormulaStyle ? `-${(id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 10) / 10}s` : undefined,
    }), [style, isIgnored, showFormulaStyle, id]);

    return (
        <BaseEdge
            path={edgePath}
            markerEnd={markerEnd}
            style={edgeStyle}
            className={(showFormulaStyle && !isIgnored) ? "animate-dash-flow" : ""}
        />
    );
});
