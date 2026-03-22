import { useState, useCallback, useRef } from 'react';
import { useReactFlow, XYPosition } from '@xyflow/react';
import { useCanvasProjection } from './useCanvasProjection';

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
        const path = cutPathRef.current;
        if (path.length > 1) {
            const edges = getEdges();
            const nodes = getNodes();
            const edgesToRemove: string[] = [];

            const projectedPath = path.map(p => project({ x: p.x, y: p.y }));

            edges.forEach(edge => {
                const sourceNode = nodes.find(n => n.id === edge.source);
                const targetNode = nodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return;

                const sx = sourceNode.position.x + (sourceNode.measured?.width || 150);
                const sy = sourceNode.position.y + (sourceNode.measured?.height || 50) / 2;
                const tx = targetNode.position.x;
                const ty = targetNode.position.y + (targetNode.measured?.height || 50) / 2;

                for (let i = 0; i < projectedPath.length - 1; i++) {
                    const p1 = projectedPath[i];
                    const p2 = projectedPath[i + 1];
                    if (linesIntersect(sx, sy, tx, ty, p1.x, p1.y, p2.x, p2.y)) {
                        edgesToRemove.push(edge.id);
                        break;
                    }
                }
            });

            if (edgesToRemove.length > 0) {
                setEdges(eds => eds.filter(e => !edgesToRemove.includes(e.id)));
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
