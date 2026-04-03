import { useState, useCallback, useRef } from 'react';
import { useReactFlow, XYPosition, Edge } from '@xyflow/react';
import { useCanvasProjection } from './useCanvasProjection';
import { useHistoryStore } from '../store/useHistoryStore';
import { Transaction } from '../engine/types/engineTypes';
import { FALLBACK_SIZE } from '../utils/GeometryUtils';

/**
 * useKnife
 * Handles the Ctrl+RightClick knife/cut tool for slicing edges.
 */
export function useKnife() {
    const { getEdges, getNodes, setEdges } = useReactFlow();
    const { project } = useCanvasProjection();

    const cutPathRef = useRef<XYPosition[]>([]);
    const [cutPath, setCutPath] = useState<XYPosition[]>([]);

    const startCut = useCallback((pos: XYPosition) => {
        cutPathRef.current = [pos];
        setCutPath([pos]);
    }, []);

    const updateCut = useCallback((pos: XYPosition) => {
        cutPathRef.current.push(pos);
        setCutPath([...cutPathRef.current]);
    }, []);

    const endCut = useCallback(() => {
        const { isRestoring, push } = useHistoryStore.getState();
        if (isRestoring) return;

        const path = cutPathRef.current;
        if (path.length > 1) {
            // Fix: Use getEdges() to avoid Stale Closures (The Closure Trap)
            const allEdges = getEdges();
            const allNodes = getNodes();
            const edgesToRemoveObjects: Edge[] = [];
            const restoredEdgeIndices: Record<string, number> = {};

            const projectedPath = path.map((p: XYPosition) => project({ x: p.x, y: p.y }));

            allEdges.forEach((edge, index) => {
                const sourceNode = allNodes.find(n => n.id === edge.source);
                const targetNode = allNodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return;

                const sw = sourceNode.measured?.width ?? sourceNode.width ?? FALLBACK_SIZE.width;
                const sh = sourceNode.measured?.height ?? sourceNode.height ?? FALLBACK_SIZE.height;
                const tw = targetNode.measured?.width ?? targetNode.width ?? FALLBACK_SIZE.width;
                const th = targetNode.measured?.height ?? targetNode.height ?? FALLBACK_SIZE.width;

                const sx = sourceNode.position.x + sw;
                const tx = targetNode.position.x;
                const HEADER_H = 52;
                const PADDING = 12;
                const SOCKET_SIZE = 12;
                
                // Visual wire start/end Y coordinates (aligned with first handles)
                const sy = sourceNode.position.y + HEADER_H + PADDING + (SOCKET_SIZE / 2);
                const ty = targetNode.position.y + HEADER_H + PADDING + (SOCKET_SIZE / 2);

                for (let i = 0; i < projectedPath.length - 1; i++) {
                    const p1 = projectedPath[i];
                    const p2 = projectedPath[i + 1];
                    
                    if (linesIntersect(sx, sy, tx, ty, p1.x, p1.y, p2.x, p2.y)) {
                        edgesToRemoveObjects.push(edge);
                        restoredEdgeIndices[edge.id] = index;
                        break;
                    }
                }
            });

            // Zero-Hit Early Return: Prevent ghost history entries
            if (edgesToRemoveObjects.length > 0) {
                const forward: Transaction[] = edgesToRemoveObjects.map(e => ({
                    type: 'DISCONNECT',
                    payload: e.id
                }));
                const inverse: Transaction[] = edgesToRemoveObjects.map(e => ({
                    type: 'CONNECT',
                    payload: { ...e }
                }));

                // Push BATCH History with V10 Metadata
                push({
                    id: `knife_${Date.now()}`,
                    description: `Knife Cut (${edgesToRemoveObjects.length} wires)`,
                    forward,
                    inverse,
                    uiMetadata: { restoredEdgeIndices }
                });

                // Trigger UI update (Brain sync happens silently via useBrainSync)
                const idsToRemove = edgesToRemoveObjects.map(e => e.id);
                setEdges(eds => eds.filter(e => !idsToRemove.includes(e.id)));
            }
        }

        cutPathRef.current = [];
        setCutPath([]);
    }, [getEdges, getNodes, setEdges, project]);

    return {
        cutPath,
        startCut,
        updateCut,
        endCut,
    };
}

function linesIntersect(a: number, b: number, c: number, d: number, p: number, q: number, r: number, s: number) {
    const det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) return false;
    const lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
    const gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

