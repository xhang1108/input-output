import { ConnectionLineComponentProps, useStore, Position, getBezierPath, getStraightPath, getSmoothStepPath, getSimpleBezierPath } from '@xyflow/react';
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useHandleMagnet } from '../../hooks/useHandleMagnet';
import { getNearestHandle } from '../../utils/geometry';
import { capsulePreviewState } from './capsulePreviewState';
import { getHandleVariant, findNearestSlot, calculateSlotOffsetY } from '../../utils/handleUtils';

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
    startEdgeDragDisconnect?: (event: React.PointerEvent, edgeId: string) => void;
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
        const variant = getHandleVariant(snappedNode, snappedHandleId);

        // Find handle type from magnet results
        const results = getNearestHandle(toX, toY, nodeLookup, 20);
        const handleType = results?.type;

        if (variant === 'capsule' && handleType === 'target') {
            const existingEdges = allEdges.filter(e => e.target === snappedNodeId && e.targetHandle === snappedHandleId);
            const total = existingEdges.length + 1;

            // Use RAW pointer Y (not React Flow's pre-snapped toY) relative to handle center
            const mouseOffset = rawMouseFlowY.current - handleCenterY;
            const absoluteMouseYForCalc = handleCenterY + mouseOffset;
            const bestIndex = findNearestSlot(absoluteMouseYForCalc, handleCenterY, total);

            // Snap wire to the exact slot Y position
            const offsetY = calculateSlotOffsetY(bestIndex, total);
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

    const getEdgeOffset = (nodeId: string | null, handleId: string | null) => {
        if (!nodeId) return 0;
        const node = nodeLookup.get(nodeId);

        let handle = node?.internals.handleBounds?.target?.find(h => h.id === handleId);
        if (!handle) {
            handle = node?.internals.handleBounds?.source?.find(h => h.id === handleId);
        }

        if (!handle) return 0;
        return (handle.width ?? 0) / 2;
    };

    const computePath = (anchorNodeId: string, anchorHandleId: string | null) => {
        const targetNode = nodeLookup.get(anchorNodeId);
        if (!targetNode) return null;

        const handleBounds = targetNode.internals?.handleBounds;
        if (!handleBounds) return null;

        const handle = (type === 'source' ? handleBounds.source : handleBounds.target)
            ?.find(h => h.id === (anchorHandleId || null)) || (type === 'source' ? handleBounds.source?.[0] : handleBounds.target?.[0]);

        if (!handle) return null;

        const anchorX = targetNode.internals.positionAbsolute.x + handle.x + (handle.width / 2);
        const anchorY = targetNode.internals.positionAbsolute.y + handle.y + (handle.height / 2);
        const anchorPos = handle.position;

        let sourceX, sourceY, sourcePos, targetX, targetY, targetPos;

        const anchorOffset = getEdgeOffset(anchorNodeId, handle.id ?? null);
        const mouseOffset = getEdgeOffset(snappedNodeId ?? null, snappedHandleId ?? null);

        if (type === 'source') {
            // Anchor is Source (Output). We are "Unplugging Input".
            // Visual: Source Anchor -> Mouse (Target)
            sourceX = anchorX + (anchorPos === Position.Left ? -anchorOffset : (anchorPos === Position.Right ? anchorOffset : 0));
            sourceY = anchorY + (anchorPos === Position.Top ? -anchorOffset : (anchorPos === Position.Bottom ? anchorOffset : 0));
            sourcePos = anchorPos;
            targetX = effectiveToX + (effectiveToPos === Position.Left ? -mouseOffset : (effectiveToPos === Position.Right ? mouseOffset : 0));
            targetY = effectiveToY + (effectiveToPos === Position.Top ? -mouseOffset : (effectiveToPos === Position.Bottom ? mouseOffset : 0));
            targetPos = effectiveToPos;
        } else {
            // Anchor is Target (Input). We are "Unplugging Output".
            // Visual: Mouse (Source) -> Target Anchor
            targetX = anchorX + (anchorPos === Position.Left ? -anchorOffset : (anchorPos === Position.Right ? anchorOffset : 0));
            targetY = anchorY + (anchorPos === Position.Top ? -anchorOffset : (anchorPos === Position.Bottom ? anchorOffset : 0));
            targetPos = anchorPos;
            sourceX = effectiveToX + (effectiveToPos === Position.Left ? -mouseOffset : (effectiveToPos === Position.Right ? mouseOffset : 0));
            sourceY = effectiveToY + (effectiveToPos === Position.Top ? -mouseOffset : (effectiveToPos === Position.Bottom ? mouseOffset : 0));
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
        // Standard connection line: fromX/Y is provided by React Flow (usually handle center)
        // effectiveToX/Y is our snapped or mouse position.
        // We need to find the "from_node" and "from_handle" to get the offset.
        // ConnectionLineComponentProps doesn't give fromNodeId/fromHandleId directly in older versions,
        // but RelinkContext should have it during active connection or we can infer it.

        // Wait, fromX/Y is usually ALREADY at the handle center. 
        // We need to look up which handle is at fromX/Y or use the store's current connection state if available.
        // Actually, RelinkLine is often used for BOTH standard dragging AND relinking.

        // New Line (Standard connection drag). React Flow provides fromX and fromY
        // already snapped to the edge of the source handle bounding box. We only need
        // to offset the mouse/snap target if it's magnetically snapped to a target.
        const toOffset = getEdgeOffset(snappedNodeId, snappedHandleId ?? null);

        const pathParams = {
            sourceX: fromX,
            sourceY: fromY,
            sourcePosition: fromPosition,
            targetX: effectiveToX + (effectiveToPos === Position.Left ? -toOffset : (effectiveToPos === Position.Right ? toOffset : 0)),
            targetY: effectiveToY + (effectiveToPos === Position.Top ? -toOffset : (effectiveToPos === Position.Bottom ? toOffset : 0)),
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
                    stroke="var(--zinc-500)" // zinc-500 to match MagneticEdge
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
                    stroke="var(--zinc-500)"
                    d={d}
                    style={{ opacity: 0.8 }}
                />
            ))}
            <circle cx={effectiveToX} cy={effectiveToY} r={4} fill="var(--zinc-500)" />
        </g>
    );
};
