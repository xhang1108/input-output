import { ConnectionLineComponentProps, useStore, Position, getBezierPath, getStraightPath, getSmoothStepPath, getSimpleBezierPath } from '@xyflow/react';
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useHandleMagnet } from '../../hooks/useHandleMagnet';
import { NODE_DEFINITIONS } from '../../definitions/nodeDefinitions';
import { capsulePreviewState } from './capsulePreviewState';

// Define Context for Relink system
export interface RelinkAnchor {
    nodeId: string;
    handleId: string | null;
}

export interface RelinkState {
    active: boolean;
    targetNodeId: string | null;   // The "Anchor" Node ID (Fixed side)
    targetHandleId: string | null; // The "Anchor" Handle ID
    type: 'source' | 'target';     // The Anchor Type: 'source' (Output) or 'target' (Input)
    anchors?: RelinkAnchor[];      // Multiple anchors for multi-wire output unplug
    edgeType?: string;             // Dynamic path type
}

export const RelinkContext = createContext<RelinkState>({
    active: false,
    targetNodeId: null,
    targetHandleId: null,
    type: 'target',
    anchors: [],
    edgeType: 'bezier',
});

export const RelinkLine = ({
    fromX,
    fromY,
    fromPosition,
    toX,
    toY,
    toPosition,
    connectionLineStyle,
}: ConnectionLineComponentProps) => {
    const { active, targetNodeId, targetHandleId, type, anchors, edgeType: relinkEdgeType } = useContext(RelinkContext);
    const nodeLookup = useStore((s) => s.nodeLookup);
    const allEdges = useStore((s) => s.edges);
    const transform = useStore((s) => s.transform); // [tx, ty, zoom]

    // Track raw pointer position in flow coordinates (bypasses React Flow's pre-snapping)
    const rawMouseFlowY = useRef(toY);
    useEffect(() => {
        const handler = (e: PointerEvent) => {
            // Convert screen coords to flow coords: flowY = (screenY - ty) / zoom
            rawMouseFlowY.current = (e.clientY - transform[1]) / transform[2];
        };
        window.addEventListener('pointermove', handler);
        return () => window.removeEventListener('pointermove', handler);
    }, [transform]);

    // Use Magnetic Snapping Hook
    const { x: effectiveToX, y: rawEffectiveToY, handleCenterY, position: snappedPos, snappedNodeId, snappedHandleId } = useHandleMagnet(toX, toY);

    // ─── Capsule Live Preview Offset ───
    // For capsule handles: X snaps to handle, Y follows raw pointer for slot selection
    let effectiveToY = rawEffectiveToY;
    let previewSlot = -1;
    let previewTotal = 0;
    let previewNodeId = '';
    let previewHandleId = '';
    if (snappedNodeId && snappedHandleId) {
        const snappedNode = nodeLookup.get(snappedNodeId);
        const snappedNodeData = snappedNode?.data as Record<string, unknown> | undefined;
        const dynamicHandles = snappedNodeData?.handles as { id: string; variant?: string }[] | undefined;
        const dynamicHandle = dynamicHandles?.find(h => h.id === snappedHandleId);
        const staticDef = NODE_DEFINITIONS.find(d => d.id === snappedNode?.type);
        const staticHandle = staticDef?.handles.find(h => h.id === snappedHandleId);
        const variant = dynamicHandle?.variant || staticHandle?.variant || 'single';

        if (variant === 'capsule') {
            const existingEdges = allEdges.filter(e => e.target === snappedNodeId && e.targetHandle === snappedHandleId);
            const total = existingEdges.length + 1;
            const SPACING = 14;

            // Use RAW pointer Y (not React Flow's pre-snapped toY) relative to handle center
            const mouseOffset = rawMouseFlowY.current - handleCenterY;
            let bestIndex = total - 1;
            let bestDist = Infinity;
            for (let i = 0; i < total; i++) {
                const slotOffset = (i - (total - 1) / 2) * SPACING;
                const dist = Math.abs(mouseOffset - slotOffset);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIndex = i;
                }
            }

            // Snap wire to the exact slot Y position
            const offsetY = (bestIndex - (total - 1) / 2) * SPACING;
            effectiveToY = handleCenterY + offsetY;

            previewSlot = bestIndex;
            previewTotal = total;
            previewNodeId = snappedNodeId;
            previewHandleId = snappedHandleId;
        }
    }

    // Publish preview state via useEffect to avoid errors during render
    useEffect(() => {
        if (previewSlot >= 0) {
            capsulePreviewState.set(previewNodeId, previewHandleId, previewSlot, previewTotal);
        } else {
            capsulePreviewState.clear();
        }
        return () => capsulePreviewState.clear();
    }, [previewNodeId, previewHandleId, previewSlot, previewTotal]);

    const defaultRelinkPos = type === 'source' ? Position.Left : Position.Right;
    const effectiveToPos = snappedPos || (active ? defaultRelinkPos : toPosition);

    const computePath = (anchorNodeId: string, anchorHandleId: string | null) => {
        const targetNode = nodeLookup.get(anchorNodeId);
        if (!targetNode) return null;

        const handleBounds = targetNode.internals?.handleBounds;
        if (!handleBounds) return null;

        // Pick the list based on Anchor Type
        const handles = type === 'source' ? handleBounds.source : handleBounds.target;
        const handle = handles?.find(h => h.id === (anchorHandleId || null)) || handles?.[0];
        if (!handle) return null;

        const anchorX = targetNode.internals.positionAbsolute.x + handle.x + (handle.width / 2);
        const anchorY = targetNode.internals.positionAbsolute.y + handle.y + (handle.height / 2);
        const anchorPos = handle.position;

        let sourceX, sourceY, sourcePos, targetX, targetY, targetPos;

        if (type === 'source') {
            // Anchor is Source (Output). We are "Unplugging Input".
            // Visual: Source Anchor -> Mouse (Target)
            sourceX = anchorX;
            sourceY = anchorY;
            sourcePos = anchorPos;
            targetX = effectiveToX;
            targetY = effectiveToY;
            targetPos = effectiveToPos;
        } else {
            // Anchor is Target (Input). We are "Unplugging Output".
            // Visual: Mouse (Source) -> Target Anchor
            targetX = anchorX;
            targetY = anchorY;
            targetPos = anchorPos;
            sourceX = effectiveToX;
            sourceY = effectiveToY;
            sourcePos = effectiveToPos;
        }

        const pathParams = {
            sourceX,
            sourceY,
            sourcePosition: sourcePos,
            targetX,
            targetY,
            targetPosition: targetPos,
        };

        let d = '';
        switch (relinkEdgeType) {
            case 'straight':
                [d] = getStraightPath(pathParams);
                break;
            case 'step':
                // React Flow sometimes uses different names or Step isn't a direct export in all versions
                // Fallback to smoothstep with 0 radius if specific step is missing or use straight
                [d] = getSmoothStepPath({ ...pathParams, borderRadius: 0 });
                break;
            case 'smoothstep':
                [d] = getSmoothStepPath(pathParams);
                break;
            case 'bezier':
            default:
                [d] = getBezierPath(pathParams);
                break;
        }

        return d;
    };

    // Build list of anchors to render
    let pathsToRender: (string | null)[] = [];

    if (active) {
        if (anchors && anchors.length > 0) {
            // Multi-wire mode
            pathsToRender = anchors.map(a => computePath(a.nodeId, a.handleId));
        } else if (targetNodeId) {
            // Single-wire fallback
            pathsToRender = [computePath(targetNodeId, targetHandleId)];
        }
    }

    // Standard connection line (no Relink active)
    if (!active || pathsToRender.length === 0) {
        const pathParams = {
            sourceX: fromX,
            sourceY: fromY,
            sourcePosition: fromPosition,
            targetX: effectiveToX,
            targetY: effectiveToY,
            targetPosition: effectiveToPos,
        };

        let d = '';
        // Use the context edgeType if provided, fallback to bezier (active check is inside if)
        const currentType = relinkEdgeType || 'bezier';

        switch (currentType) {
            case 'straight': [d] = getStraightPath(pathParams); break;
            case 'step': [d] = getSmoothStepPath({ ...pathParams, borderRadius: 0 }); break;
            case 'smoothstep': [d] = getSmoothStepPath(pathParams); break;
            default: [d] = getBezierPath(pathParams); break;
        }

        return (
            <g>
                <path
                    fill="none"
                    strokeWidth={2}
                    stroke="#71717a" // zinc-500 to match MagneticEdge
                    d={d}
                    style={{ ...connectionLineStyle, opacity: 0.8 }}
                />
            </g>
        );
    }

    // Relink multi-wire rendering
    return (
        <g>
            {pathsToRender.map((d, i) => d && (
                <path
                    key={i}
                    fill="none"
                    strokeWidth={2}
                    stroke="#71717a"
                    d={d}
                    style={{ opacity: 0.8 }}
                />
            ))}
            <circle cx={effectiveToX} cy={effectiveToY} r={4} fill="#71717a" />
        </g>
    );
};
