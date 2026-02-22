'use client';

import { useCallback, useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { intersectsRect } from '../utils/geometry';
import { generateNodeId } from '../utils/idGenerator';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';

interface UseAutoInsertProps {
    nodes: Node[];
    edges: Edge[];
    mode: string;
    edgeType: string;
    edgeAnimation: boolean;
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
    edgeAnimation,
    setEdges,
    logAction,
}: UseAutoInsertProps) {
    const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);

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

        // 1. Get Node Center
        const w = node.measured?.width || 150;
        const h = node.measured?.height || 50;
        const cx = node.position.x + w / 2;
        const cy = node.position.y + h / 2;

        let bestEdge: string | null = null;
        const minInfo = { dist: Infinity };

        // 2. Check Intersections
        for (const edge of edges) {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) continue;

            if (sourceNode.id === targetNode.id) continue;
            if (sourceNode.selected || targetNode.selected) continue;

            const sx = sourceNode.position.x + (sourceNode.measured?.width || 150) / 2;
            const sy = sourceNode.position.y + (sourceNode.measured?.height || 50) / 2;
            const tx = targetNode.position.x + (targetNode.measured?.width || 150) / 2;
            const ty = targetNode.position.y + (targetNode.measured?.height || 50) / 2;

            const l2 = Math.pow(tx - sx, 2) + Math.pow(ty - sy, 2);
            if (l2 === 0) continue;

            let t = ((cx - sx) * (tx - sx) + (cy - sy) * (ty - sy)) / l2;
            t = Math.max(0, Math.min(1, t));
            const px = sx + t * (tx - sx);
            const py = sy + t * (ty - sy);
            const dist = Math.sqrt(Math.pow(cx - px, 2) + Math.pow(cy - py, 2));

            // Check intersection (Segment vs Expanded Box)
            const buffer = 2;
            const hasIntersection = intersectsRect(
                sx, sy, tx, ty,
                node.position.x - buffer, node.position.y - buffer,
                w + buffer * 2, h + buffer * 2
            );

            if (hasIntersection && dist < minInfo.dist) {
                minInfo.dist = dist;
                bestEdge = edge.id;
            }
        }

        if (bestEdge !== highlightedEdgeId) {
            setHighlightedEdgeId(bestEdge);
        }
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
                    data: { pathType: edgeType, animate: edgeAnimation }
                };

                const e2: Edge = {
                    id: generateNodeId('edge'),
                    source: node.id,
                    sourceHandle: outputHandle,
                    target: targetId,
                    targetHandle: edge.targetHandle,
                    type: 'magnetic',
                    data: { pathType: edgeType, animate: edgeAnimation }
                };

                setEdges(eds => eds.filter(e => e.id !== highlightedEdgeId).concat([e1, e2]));
                logAction(`Auto Insert: ${node.id} into ${edge.id}`);
            }
            setHighlightedEdgeId(null);
        }
    }, [highlightedEdgeId, nodes, edges, edgeType, edgeAnimation, setEdges, logAction]);

    return {
        highlightedEdgeId,
        detectAutoInsert,
        performAutoInsert,
    };
}
