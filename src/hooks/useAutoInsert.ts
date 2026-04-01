'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Node, Edge, useReactFlow, useStore } from '@xyflow/react';
import { generateNodeId } from '../utils/idGenerator';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';

interface UseAutoInsertProps {
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
    mode,
    edgeType,
    setEdges,
    logAction,
}: UseAutoInsertProps) {
    const nodes = useStore((s) => s.nodes);
    const edges = useStore((s) => s.edges);
    const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);
    const { screenToFlowPosition } = useReactFlow();
    
    // rAF Orchestration Refs
    const rafId = useRef<number | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rafId.current !== null) {
                cancelAnimationFrame(rafId.current);
            }
        };
    }, []);

    const detectAutoInsert = useCallback(() => {
        if (mode !== 'GRABBING') {
            if (highlightedEdgeId) setHighlightedEdgeId(null);
            return;
        }

        // Layer 0: rAF Guard (Cleanup previous if exists to ensure latest frame)
        if (rafId.current !== null) {
            cancelAnimationFrame(rafId.current);
        }

        rafId.current = requestAnimationFrame(() => {
            rafId.current = null;
            
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

            // 1. Get Sensing Center via Red-Dot Offset (Flow Space)
            const SENSING_OFFSET_X = 60; 
            const SENSING_OFFSET_Y = 40;
            const cx = node.position.x + SENSING_OFFSET_X;
            const cy = node.position.y + SENSING_OFFSET_Y;

            // Hysteresis: Buffer expansion based on current state
            // Entry: 100px detection radius
            // Exit: 110px detection radius (to prevent flickering)
            const currentPadding = highlightedEdgeId ? 110 : 100;
            const detRadius = 15; // The actual sampling hit-box size (smaller than AABB)
            
            const left = cx - detRadius;
            const top = cy - detRadius;
            const right = cx + detRadius;
            const bottom = cy + detRadius;

            let bestEdge: string | null = null;
            let minCenterDist = Infinity;

            const nodeMap = new Map(nodes.map(n => [n.id, n]));

            // 2. Optimized Loop with AABB Fast Rejection
            for (const edge of edges) {
                if (edge.source === node.id || edge.target === node.id) continue;

                // LAYER 1: Curved AABB Rejection
                const sourceNode = nodeMap.get(edge.source);
                const targetNode = nodeMap.get(edge.target);
                if (!sourceNode || !targetNode) continue;

                // Simple AABB covering both nodes + large padding for curve
                // We use the Hysteresis padding here as the rejection boundary
                const edgeMinX = Math.min(sourceNode.position.x, targetNode.position.x) - currentPadding;
                const edgeMaxX = Math.max(sourceNode.position.x, targetNode.position.x) + currentPadding;
                const edgeMinY = Math.min(sourceNode.position.y, targetNode.position.y) - currentPadding;
                const edgeMaxY = Math.max(sourceNode.position.y, targetNode.position.y) + currentPadding;

                // Fast AABB check
                if (cx < edgeMinX || cx > edgeMaxX || cy < edgeMinY || cy > edgeMaxY) continue;

                // LAYER 2: Precision SVG Sampling (Fast-Path because AABB pruned 95%+)
                const edgeContainer = document.querySelector(`[data-id="${edge.id}"]`);
                if (!edgeContainer) continue;

                const pathEl = edgeContainer.querySelector('path.react-flow__edge-interaction') as SVGPathElement ||
                    edgeContainer.querySelector('path.react-flow__edge-path') as SVGPathElement;

                if (!pathEl || typeof pathEl.getTotalLength !== 'function') continue;

                try {
                    const totalLength = pathEl.getTotalLength();
                    if (totalLength === 0) continue;

                    // Sample every 20px along the curve path (slightly larger step for performance)
                    const STEP = 20;
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
        });
    }, [mode, nodes, edges, highlightedEdgeId]);

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
