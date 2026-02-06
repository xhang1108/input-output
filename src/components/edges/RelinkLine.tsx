import { ConnectionLineComponentProps, useStore } from '@xyflow/react';
import { getBezierPath } from '@xyflow/react';
import React, { createContext, useContext } from 'react';
import { useHandleMagnet } from '../../hooks/useHandleMagnet';

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
}

export const RelinkContext = createContext<RelinkState>({
    active: false,
    targetNodeId: null,
    targetHandleId: null,
    type: 'target',
    anchors: [],
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
    const { active, targetNodeId, targetHandleId, type, anchors } = useContext(RelinkContext);
    const nodeLookup = useStore((s) => s.nodeLookup);

    // Use Magnetic Snapping Hook
    const { x: effectiveToX, y: effectiveToY, position: snappedPos } = useHandleMagnet(toX, toY);
    const effectiveToPos = snappedPos || toPosition;

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

        const [d] = getBezierPath({
            sourceX,
            sourceY,
            sourcePosition: sourcePos,
            targetX,
            targetY,
            targetPosition: targetPos,
        });

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
        const [d] = getBezierPath({
            sourceX: fromX,
            sourceY: fromY,
            sourcePosition: fromPosition,
            targetX: effectiveToX,
            targetY: effectiveToY,
            targetPosition: effectiveToPos,
        });

        return (
            <g>
                <path
                    fill="none"
                    strokeWidth={2}
                    stroke="#b1b1b7"
                    d={d}
                    style={connectionLineStyle}
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
                    stroke="#b1b1b7"
                    d={d}
                    className="animated"
                    style={{ strokeDasharray: 5, animation: 'dashdraw 0.5s linear infinite' }}
                />
            ))}
            <circle cx={effectiveToX} cy={effectiveToY} r={4} fill="#b1b1b7" />
        </g>
    );
};
