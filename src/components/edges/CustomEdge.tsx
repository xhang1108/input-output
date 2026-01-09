'use client';

import {
    BaseEdge,
    getSmoothStepPath,
    getBezierPath,
    getStraightPath,
    useReactFlow,
    useStore,
    useStoreApi,
    Position,
    type EdgeProps,
    type ReactFlowState,
} from '@xyflow/react';
import { memo, useMemo, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { pullValue } from '@/engine/Brain';

import { useRenderTracker } from '../debug/Profiler';
import './edge-anim.css';

export const CustomEdge = memo((props: EdgeProps) => {
    useRenderTracker('Edge');
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

    const { getNode, getNodes, getEdges } = useReactFlow();

    const { logicVersion, settings } = useAppStore(); // Destructure settings here too for path logic

    // 1. Calculate Path
    const pathParams = {
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    };

    let edgePath = '';
    // Select path algorithm based on settings
    switch (settings.edgeStyle) {
        case 'straight':
            [edgePath] = getStraightPath(pathParams);
            break;
        case 'bezier':
            [edgePath] = getBezierPath(pathParams);
            break;
        case 'step':
        default:
            [edgePath] = getSmoothStepPath({
                ...pathParams,
                borderRadius: 20,
            });
            break;
    }

    // 3. Determine Flow Type (Formula vs Value)
    const isFormula = !!(data as any)?.isFormula;


    const store = useStoreApi();

    // 3.1 Detect Data Type (Matrix/Array = Thick Wire)
    const isThick = useMemo(() => {
        try {
            const edges = getEdges();

            // Pull only from source to see what it's carrying
            // Optimization: Use imperative store access to avoid re-rendering on every node move
            const nodeLookup = store.getState().nodeLookup;
            const payload = pullValue(source, nodeLookup, edges, new Set());
            const val = payload.val;
            return Array.isArray(val) || (val && (val.isMatrix || val.toArray));
        } catch (e) {
            return false;
        }
    }, [source, getEdges, logicVersion]); // Re-check on logic update

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
    // Settings are available from the top-level hook

    const edgeStyle = useMemo(() => {
        let strokeWidth = 2;
        if (isThick) strokeWidth += 2.5;

        // Simplify: Only animate if explicitly formula data and enabled in settings
        // (Previously relied on global displayMode)
        const shouldAnimate = isFormula && settings.enableAnimations;
        const showFormulaStyle = isFormula; // Always show purple for formula edges

        // If animation is disabled, we also disable dashes to make it solid
        const dashArray = (shouldAnimate) ? '5 5' : undefined;

        // Calculate delay
        const delay = shouldAnimate
            ? `-${(id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 10) / 10}s`
            : undefined;

        const debugStroke = showFormulaStyle ? '#a855f7' : '#71717a';

        return {
            ...style,
            stroke: isIgnored ? '#d4d4d8' : debugStroke,
            strokeWidth,
            strokeDasharray: dashArray || 'none',
            opacity: isIgnored ? 0.3 : 1,
            animation: 'none',
            animationDelay: delay,
        };
    }, [style, isIgnored, isFormula, isThick, id, settings.enableAnimations]);

    const shouldAnimate = isFormula && !isIgnored && settings.enableAnimations;

    return (
        <BaseEdge
            path={edgePath}
            markerEnd={markerEnd}
            style={edgeStyle}
            className={shouldAnimate ? "anim-flowing-edge" : ""}
        />
    );
});
