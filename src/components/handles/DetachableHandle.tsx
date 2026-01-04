'use client';

import { Handle, useReactFlow, type HandleProps } from '@xyflow/react';
import { BaseHandle } from './BaseHandle';
import { useCallback, useRef } from 'react';

interface DetachableHandleProps extends HandleProps {
    nodeId: string;
}

/**
 * A Handle component that supports Blender-style edge detachment.
 * 
 * When you mousedown on a connected target (input) handle, it will:
 * 1. Find the edge connected to this handle
 * 2. Delete that edge
 * 3. Find the source handle's DOM element and dispatch a mousedown event on it
 * 
 * Key insights:
 * - Event must be dispatched SYNCHRONOUSLY (same event loop tick)
 * - Must use source handle's center coordinates so React Flow identifies the connection start point
 * - DOM query uses .react-flow__node[data-id="..."] to find the node, then .react-flow__handle.source within it
 */
export function DetachableHandle({ nodeId, id, type, ...props }: DetachableHandleProps) {
    const { setEdges, getEdges } = useReactFlow();
    const isDetaching = useRef(false);

    const handleMouseDown = useCallback(
        (event: React.MouseEvent) => {
            // Only intercept for target (input) handles
            if (type !== 'target') return;

            // Prevent re-entry if already detaching or processing
            if (isDetaching.current) return;

            const edges = getEdges();

            // Normalize handle ID (React Flow treats undefined handle as null in edges)
            const normalizedId = id ?? null;

            // 1️⃣ Find edge connected to this specific handle
            const connectedEdge = edges.find((e) => {
                if (e.target !== nodeId) return false;
                const edgeHandle = e.targetHandle ?? null;
                return edgeHandle === normalizedId;
            });

            // If no edge connected, let normal behavior proceed
            if (!connectedEdge) return;

            // Mark that we're detaching immediately
            isDetaching.current = true;

            // Get source handle information BEFORE anything else
            const sourceNodeId = connectedEdge.source;
            const sourceHandleId = connectedEdge.sourceHandle;
            const edgeId = connectedEdge.id; // Store ID for stable filtering

            // 4️⃣ Find the source handle's DOM element FIRST
            const nodeElement = document.querySelector(`.react-flow__node[data-id="${sourceNodeId}"]`);

            // If we can't find the source node, abort and reset flag
            if (!nodeElement) {
                isDetaching.current = false;
                return;
            }

            // Find source handle within the node
            let sourceHandleElement: HTMLElement | null = null;
            const sourceHandles = nodeElement.querySelectorAll('.react-flow__handle.source');

            if (sourceHandleId) {
                sourceHandleElement = (Array.from(sourceHandles).find(
                    (h) => h.getAttribute('data-handleid') === sourceHandleId
                ) as HTMLElement) || null;
            }

            if (!sourceHandleElement && sourceHandles.length > 0) {
                sourceHandleElement = sourceHandles[0] as HTMLElement;
            }

            if (!sourceHandleElement) {
                isDetaching.current = false;
                return;
            }

            // 2️⃣ Prevent default behavior
            event.preventDefault();
            event.stopPropagation();

            // 3️⃣ Delete the existing edge
            // Use functional update to ensure we're working with latest state
            setEdges((eds) => eds.filter((e) => e.id !== edgeId));

            // 5️⃣ Create and dispatch a synthetic mousedown event on the source handle
            const syntheticMouseDown = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: event.clientX,
                clientY: event.clientY,
                button: 0,
                buttons: 1,
                view: window,
            });

            // Dispatch SYNCHRONOUSLY
            sourceHandleElement.dispatchEvent(syntheticMouseDown);

            // Reset the flag after a slightly longer delay to ensure React Flow cycle completes
            setTimeout(() => {
                isDetaching.current = false;
            }, 50);
        },
        [nodeId, id, type, getEdges, setEdges]
    );

    // Filter out conflicting color/size classes to enforce standard BaseHandle styles
    const cleanClassName = (props.className || '')
        .replace(/!bg-[^\s]+/g, '')
        .replace(/!border-[^\s]+/g, '')
        .replace(/!w-[^\s]+/g, '')
        .replace(/!h-[^\s]+/g, '');

    return (
        <BaseHandle
            {...props}
            id={id}
            type={type}
            color="green" // Enforce Green for Input/Target handles
            onMouseDown={handleMouseDown}
            className={cleanClassName}
            style={{
                ...props.style,
                pointerEvents: 'all',
                // zIndex is handled by BaseHandle (10)
            }}
        />
    );
}
