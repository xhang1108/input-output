'use client';

import { useCallback, useState } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { generateNodeId } from '../utils/idGenerator';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';

interface UseAutoInsertProps {
    nodes: Node[];
    edges: Edge[];
    mode: string;
    edgeType: string;
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    logAction: (msg: string) => void;
}

/**
 * useAutoInsert
 * Handles the "drag node over edge to split" interaction.
 * Detects when a grabbed node overlaps an existing edge and performs
 * an automatic edge-split insertion on mouse release.
 */
export function useAutoInsert({
    nodes,
    edges,
    mode,
    edgeType,
    setEdges,
    logAction,
}: UseAutoInsertProps) {
    const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);
    const { flowToScreenPosition } = useReactFlow();

    const detectAutoInsert = useCallback(() => {
        if (mode !== 'GRABBING') return;

        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length !== 1) {
            if (highlightedEdgeId) setHighlightedEdgeId(null);
            return;
        }

        const node = selectedNodes[0];

        // 0. Check if the node already has connections
        const nodeHasEdges = edges.some(e => e.source === node.id || e.target === node.id);
        if (nodeHasEdges) {
            if (highlightedEdgeId) setHighlightedEdgeId(null);
            return;
        }

        // 1. Get Node Center and Bounds
        const w = node.measured?.width || 150;
        const h = node.measured?.height || 50;
        const padding = 10; // Extra magnetic pull region
        const left = node.position.x - padding;
        const top = node.position.y - padding;
        const right = node.position.x + w + padding;
        const bottom = node.position.y + h + padding;
        const cx = node.position.x + w / 2;
        const cy = node.position.y + h / 2;

        let bestEdge: string | null = null;
        let minCenterDist = Infinity;

        // 2. Check SVG Intersections natively
        // Instead of sampling screen DOM pixels (which can be slow or miss parts of the node box),
        // we directly sample points along the exact SVG vector paths of the edges. 
        // Their transform local-space maps 1:1 with node.position!
        for (const edge of edges) {
            if (edge.source === node.id || edge.target === node.id) continue;

            const edgeContainer = document.querySelector(`[data-id="${edge.id}"]`);
            if (!edgeContainer) continue;

            const pathEl = edgeContainer.querySelector('path.react-flow__edge-interaction') as SVGPathElement ||
                edgeContainer.querySelector('path.react-flow__edge-path') as SVGPathElement;

            if (!pathEl || typeof pathEl.getTotalLength !== 'function') continue;

            try {
                const totalLength = pathEl.getTotalLength();
                if (totalLength === 0) continue;

                // Sample every 15 pixels along the curve path
                const STEP = 15;
                const steps = Math.ceil(totalLength / STEP);

                let collided = false;
                let closestDist = Infinity;

                for (let i = 0; i <= steps; i++) {
                    const point = pathEl.getPointAtLength(Math.min(i * STEP, totalLength));

                    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) {
                        collided = true;
                        const distToCenter = Math.hypot(point.x - cx, point.y - cy);
                        if (distToCenter < closestDist) closestDist = distToCenter;
                    }
                }

                if (collided && closestDist < minCenterDist) {
                    minCenterDist = closestDist;
                    bestEdge = edge.id;
                }
            } catch (err) {
                // Ignore empty path errors
            }
        }

        if (bestEdge !== highlightedEdgeId) {
            setHighlightedEdgeId(bestEdge);
        }
    }, [mode, nodes, edges, highlightedEdgeId, flowToScreenPosition]);

    const performAutoInsert = useCallback(() => {
        if (highlightedEdgeId) {
            const edge = edges.find(e => e.id === highlightedEdgeId);
            const selectedNodes = nodes.filter(n => n.selected);
            const node = selectedNodes[0];

            if (edge && node) {
                const sourceId = edge.source;
                const targetId = edge.target;

                const nodeDef = NODE_DEFINITIONS.find(d => d.id === node.type);

                let inputHandle = 'in';
                let outputHandle = 'out';

                if (nodeDef && nodeDef.handles) {
                    const firstIn = nodeDef.handles.find(h => h.type === 'target');
                    const firstOut = nodeDef.handles.find(h => h.type === 'source');
                    if (firstIn) inputHandle = firstIn.id;
                    if (firstOut) outputHandle = firstOut.id;
                }

                const e1: Edge = {
                    id: generateNodeId('edge'),
                    source: sourceId,
                    sourceHandle: edge.sourceHandle,
                    target: node.id,
                    targetHandle: inputHandle,
                    type: 'magnetic',
                    data: { pathType: edgeType }
                };

                const e2: Edge = {
                    id: generateNodeId('edge'),
                    source: node.id,
                    sourceHandle: outputHandle,
                    target: targetId,
                    targetHandle: edge.targetHandle,
                    type: 'magnetic',
                    data: { pathType: edgeType }
                };

                setEdges(eds => eds.filter(e => e.id !== highlightedEdgeId).concat([e1, e2]));
                logAction(`Auto Insert: ${node.id} into ${edge.id}`);
            }
            setHighlightedEdgeId(null);
        }
    }, [highlightedEdgeId, nodes, edges, edgeType, setEdges, logAction]);

    return {
        highlightedEdgeId,
        detectAutoInsert,
        performAutoInsert,
    };
}
