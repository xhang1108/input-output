import { useCallback, useMemo } from 'react';
import { useReactFlow, type Node, type Edge, getSmoothStepPath, Position, type XYPosition } from '@xyflow/react';

// --- Math Helpers (Perception Logic) ---

function distanceToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

function lineIntersection(p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number }, p4: { x: number, y: number }) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (d === 0) return null; // Parallel
    const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        return {
            x: p1.x + u * (p2.x - p1.x),
            y: p1.y + u * (p2.y - p1.y)
        };
    }
    return null;
}

function pathIntersectsLine(pathStr: string, p1: { x: number, y: number }, p2: { x: number, y: number }): boolean {
    if (!pathStr) return false;

    const normalized = pathStr
        .replace(/([a-zA-Z])/g, ' $1 ')
        .replace(/,/g, ' ')
        .trim();

    const tokens = normalized.split(/\s+/);

    let current = { x: 0, y: 0 };
    let i = 0;
    while (i < tokens.length) {
        const cmd = tokens[i];
        if (cmd === 'M' || cmd === 'L') {
            const x = parseFloat(tokens[i + 1]);
            const y = parseFloat(tokens[i + 2]);
            const next = { x, y };

            if (cmd === 'L') {
                if (lineIntersection(p1, p2, current, next)) return true;
            }
            current = next;
            i += 3;
        } else if (cmd === 'Q') {
            const cp = { x: parseFloat(tokens[i + 1]), y: parseFloat(tokens[i + 2]) };
            const next = { x: parseFloat(tokens[i + 3]), y: parseFloat(tokens[i + 4]) };
            const mid = {
                x: 0.25 * current.x + 0.5 * cp.x + 0.25 * next.x,
                y: 0.25 * current.y + 0.5 * cp.y + 0.25 * next.y
            };
            if (lineIntersection(p1, p2, current, mid)) return true;
            if (lineIntersection(p1, p2, mid, next)) return true;
            current = next;
            i += 5;
        } else if (cmd === 'C') {
            const cp1 = { x: parseFloat(tokens[i + 1]), y: parseFloat(tokens[i + 2]) };
            const cp2 = { x: parseFloat(tokens[i + 3]), y: parseFloat(tokens[i + 4]) };
            const next = { x: parseFloat(tokens[i + 5]), y: parseFloat(tokens[i + 6]) };

            // Sample Cubic Bezier into 4 segments (t=0.25, 0.5, 0.75)
            const sample = (t: number) => {
                const invT = 1 - t;
                return {
                    x: invT ** 3 * current.x + 3 * invT ** 2 * t * cp1.x + 3 * invT * t ** 2 * cp2.x + t ** 3 * next.x,
                    y: invT ** 3 * current.y + 3 * invT ** 2 * t * cp1.y + 3 * invT * t ** 2 * cp2.y + t ** 3 * next.y
                };
            };

            const p_25 = sample(0.25);
            const p_50 = sample(0.5);
            const p_75 = sample(0.75);

            if (lineIntersection(p1, p2, current, p_25)) return true;
            if (lineIntersection(p1, p2, p_25, p_50)) return true;
            if (lineIntersection(p1, p2, p_50, p_75)) return true;
            if (lineIntersection(p1, p2, p_75, next)) return true;

            current = next;
            i += 7;
        } else {
            i++;
        }
    }
    return false;
}

export const useEye = () => {
    const { fitView, getNodes, getEdges } = useReactFlow();

    // Focus on specific nodes or the whole graph if empty
    const focus = useCallback((nodes: Node[] = []) => {
        if (nodes.length > 0) {
            fitView({ nodes, duration: 800, padding: 0.2 });
        } else {
            fitView({ duration: 800, padding: 0.2 });
        }
    }, [fitView]);

    // Perception: Identify edges intersected by a path
    const seeCuts = useCallback((path: XYPosition[]): Edge[] => {
        if (path.length < 2) return [];
        const edges = getEdges();
        const nodes = getNodes();
        const victims: Edge[] = [];
        const checkedIds = new Set<string>();

        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const edgePaths: { edge: Edge, pathStr: string }[] = [];
        for (const edge of edges) {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) continue;

            const sx = src.position.x + (src.measured?.width ?? 150);
            const sy = src.position.y + (src.measured?.height ?? 50) / 2;
            const tx = tgt.position.x;
            const ty = tgt.position.y + (tgt.measured?.height ?? 50) / 2;

            const [edgePathStr] = getSmoothStepPath({
                sourceX: sx,
                sourceY: sy,
                sourcePosition: Position.Right,
                targetX: tx,
                targetY: ty,
                targetPosition: Position.Left,
                borderRadius: 20
            });
            edgePaths.push({ edge, pathStr: edgePathStr });
        }

        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];

            for (const ep of edgePaths) {
                if (checkedIds.has(ep.edge.id)) continue;
                if (pathIntersectsLine(ep.pathStr, p1, p2)) {
                    victims.push(ep.edge);
                    checkedIds.add(ep.edge.id);
                }
            }
        }

        return victims;
    }, [getNodes, getEdges]);

    // Perception: Detect if connecting source->target would create a cycle
    const detectCycle = useCallback((sourceId: string, targetId: string) => {
        if (sourceId === targetId) return true;

        const edges = getEdges();
        // BFS to check if Target reaches Source
        const queue = [targetId];
        const visited = new Set<string>([targetId]);
        const adjacency = new Map<string, string[]>();

        edges.forEach(e => {
            if (!adjacency.has(e.source)) adjacency.set(e.source, []);
            adjacency.get(e.source)!.push(e.target);
        });

        while (queue.length > 0) {
            const curr = queue.shift()!;
            if (curr === sourceId) return true;

            const neighbors = adjacency.get(curr) || [];
            for (const next of neighbors) {
                if (!visited.has(next)) {
                    visited.add(next);
                    queue.push(next);
                }
            }
        }
        return false;
    }, [getEdges]);

    // Perception: Scan for a nearby edge to split (Auto-Insert)
    const scanInsertionCandidate = useCallback((node: Node, threshold: number = 30) => {
        if (node.type === 'inputNode') return null; // Logic check (Perception knows rules?) Perception knows geometry.

        const currentEdges = getEdges();
        const currentNodes = getNodes();

        const candidateEdges = currentEdges.filter(e => e.source !== node.id && e.target !== node.id);

        const w = node.measured?.width || node.width || 150;
        const h = node.measured?.height || node.height || 50;
        const cx = node.position.x + w / 2;
        const cy = node.position.y + h / 2;

        for (const edge of candidateEdges) {
            const sourceNode = currentNodes.find(n => n.id === edge.source);
            const targetNode = currentNodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) continue;

            const sx = sourceNode.position.x + (sourceNode.measured?.width || 150) / 2;
            const sy = sourceNode.position.y + (sourceNode.measured?.height || 50) / 2;
            const tx = targetNode.position.x + (targetNode.measured?.width || 150) / 2;
            const ty = targetNode.position.y + (targetNode.measured?.height || 50) / 2;

            const dist = distanceToSegment(cx, cy, sx, sy, tx, ty);

            if (dist < threshold) {
                // Check Port Availability (Vision)
                let targetHandle = 'inputA';

                if (node.type === 'mathNode') {
                    const isInputAOccupied = currentEdges.some(e => e.target === node.id && e.targetHandle === 'inputA');
                    const isInputBOccupied = currentEdges.some(e => e.target === node.id && e.targetHandle === 'inputB');

                    if (isInputAOccupied) {
                        if (isInputBOccupied) continue; // Full
                        targetHandle = 'inputB';
                    }
                } else {
                    const isInputAOccupied = currentEdges.some(e => e.target === node.id && e.targetHandle === 'inputA');
                    if (isInputAOccupied) continue; // Full
                }

                return { edge, targetHandle };
            }
        }
        return null;
    }, [getNodes, getEdges]);

    const eyes = useMemo(() => ({
        focus,
        seeCuts,
        detectCycle,
        scanInsertionCandidate
    }), [focus, seeCuts, detectCycle, scanInsertionCandidate]);

    return {
        eyes
    };
};
