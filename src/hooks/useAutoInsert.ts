'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { generateNodeId, generateEdgeId } from '../utils/idGenerator';
import { NODE_DEFINITIONS } from '@/types/nodeDefinitions';
import { Brain } from '../engine/Brain';
import { useHistoryStore } from '../store/useHistoryStore';
import { Transaction } from '../engine/types/engineTypes';
import { useAppStore } from '../store/useStore';
import type { CoordinateNode } from '../utils/coordinates';
import { indexNodes, toAbsolute } from '../utils/coordinates';

interface UseAutoInsertProps {
    mode: string;
    brain: Brain;
    logAction: (msg: string) => void;
}

/** Axis-aligned box of an edge's endpoints in flow (world) space. */
export interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/** Minimal edge shape needed to precompute candidate geometry. */
export interface AutoInsertEdge {
    id: string;
    source: string;
    target: string;
}

/**
 * Node shape needed for edge bounds. Size is optional: React Flow fills
 * `measured` after layout, and a missing size falls back to the position box.
 */
export interface BoundedNode extends CoordinateNode {
    width?: number | null;
    height?: number | null;
    measured?: { width?: number; height?: number } | null;
}

/** Path-like object used by the per-grab length cache (SVGPathElement fits). */
export interface PathMeasure {
    isConnected: boolean;
    getTotalLength(): number;
}

export interface PathCacheEntry<T extends PathMeasure> {
    el: T | null;
    length: number;
}

interface GrabbingSession {
    nodeId: string;
    /** Parent-local position captured when the grab started. */
    startPosition: { x: number; y: number };
    /** World position captured when the grab started. */
    startAbsolute: { x: number; y: number };
    nodeHasEdges: boolean;
    /** Absolute endpoint bounds per edge, computed once per grab. */
    edgeBounds: Map<string, Bounds>;
    /** Reused path element + measured length per edge. */
    pathCache: Map<string, PathCacheEntry<SVGPathElement>>;
}

const SENSING_OFFSET_X = 60;
const SENSING_OFFSET_Y = 40;
const DETECT_RADIUS = 15;

/**
 * Absolute endpoint bounds for every edge whose endpoints exist.
 *
 * Bounds use the node rectangles, not just top-left positions: React Flow puts
 * edge endpoints on the node border, so a path can sit up to a node half-width
 * or half-height outside the position box. Bezier control points stay between
 * those endpoints, so the endpoint enclosures are a conservative edge box.
 */
export function buildEdgeBounds(
    nodesById: ReadonlyMap<string, BoundedNode>,
    edges: readonly AutoInsertEdge[]
): Map<string, Bounds> {
    const bounds = new Map<string, Bounds>();

    const rectOf = (node: BoundedNode) => {
        const absolute = toAbsolute(nodesById, node.id);
        const width = node.measured?.width ?? node.width ?? 0;
        const height = node.measured?.height ?? node.height ?? 0;
        return {
            minX: absolute.x,
            maxX: absolute.x + width,
            minY: absolute.y,
            maxY: absolute.y + height,
        };
    };

    for (const edge of edges) {
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        if (!source || !target) continue;

        const sourceRect = rectOf(source);
        const targetRect = rectOf(target);

        bounds.set(edge.id, {
            minX: Math.min(sourceRect.minX, targetRect.minX),
            maxX: Math.max(sourceRect.maxX, targetRect.maxX),
            minY: Math.min(sourceRect.minY, targetRect.minY),
            maxY: Math.max(sourceRect.maxY, targetRect.maxY),
        });
    }

    return bounds;
}

/**
 * Edge ids whose endpoint bbox expanded by `radius` contains (x, y).
 *
 * A sampled point within `radius` of the center implies the center lies in the
 * bbox of that point expanded by `radius`, so a larger radius never drops a
 * true hit. We keep the old 100/110 px reach because a cubic bezier can bow
 * outside its endpoint box; the win comes from caching, not from narrowing.
 */
export function pickCandidateEdgeIds(
    bounds: ReadonlyMap<string, Bounds>,
    x: number,
    y: number,
    radius: number
): string[] {
    const ids: string[] = [];

    for (const [id, box] of bounds) {
        if (x < box.minX - radius || x > box.maxX + radius) continue;
        if (y < box.minY - radius || y > box.maxY + radius) continue;
        ids.push(id);
    }

    return ids;
}

/**
 * Returns the cached path element and length while it is still in the document,
 * otherwise re-resolves the element and measures it once. `null` entries are
 * retried on the next call, matching the old query-per-frame behaviour.
 */
export function getOrMeasure<T extends PathMeasure>(
    cache: Map<string, PathCacheEntry<T>>,
    edgeId: string,
    resolve: () => T | null
): { el: T; length: number } | null {
    const cached = cache.get(edgeId);
    if (cached?.el && cached.el.isConnected && typeof cached.el.getTotalLength === 'function') {
        return { el: cached.el, length: cached.length };
    }

    const el = resolve();
    if (!el || typeof el.getTotalLength !== 'function') {
        cache.set(edgeId, { el: null, length: 0 });
        return null;
    }

    try {
        const length = el.getTotalLength();
        cache.set(edgeId, { el, length });
        return { el, length };
    } catch {
        cache.set(edgeId, { el: null, length: 0 });
        return null;
    }
}

function createGrabbingSession(
    node: Node,
    nodes: readonly Node[],
    edges: readonly Edge[]
): GrabbingSession {
    const nodesById = indexNodes(nodes);

    return {
        nodeId: node.id,
        startPosition: { x: node.position.x, y: node.position.y },
        startAbsolute: toAbsolute(nodesById, node.id),
        nodeHasEdges: edges.some(e => e.source === node.id || e.target === node.id),
        // Edges touching the dragged node abort the scan, so they are dropped
        // once here instead of being skipped on every frame.
        edgeBounds: buildEdgeBounds(
            nodesById,
            edges.filter(e => e.source !== node.id && e.target !== node.id)
        ),
        pathCache: new Map(),
    };
}

/**
 * useAutoInsert
 * Handles the "drag node over edge to split" interaction.
 * Detects when a grabbed node overlaps an existing edge and performs
 * an automatic edge-split insertion on mouse release.
 */
export function useAutoInsert({
    mode,
    brain,
    logAction,
}: UseAutoInsertProps) {
    const highlightedEdgeId = useAppStore(s => s.highlightedEdgeId);
    const setHighlightedEdgeId = useAppStore(s => s.setHighlightedEdgeId);

    const { getNodes, getEdges } = useReactFlow();
    const pushHistory = useHistoryStore(s => s.push);
    
    // rAF Orchestration Refs
    const rafId = useRef<number | null>(null);
    const dragStartPosRef = useRef<{ x: number, y: number } | null>(null);
    // Per-grab cache: graph shape and edge geometry are frozen while one
    // unconnected node is dragged, so all lookups happen once per gesture.
    const sessionRef = useRef<GrabbingSession | null>(null);

    // Capture Drag Start Position for atomic Undo
    useEffect(() => {
        if (mode === 'GRABBING') {
            const nodes = getNodes();
            const selectedNodes = nodes.filter(n => n.selected);
            if (selectedNodes.length === 1) {
                const node = selectedNodes[0];
                dragStartPosRef.current = { ...node.position };

                const existing = sessionRef.current;
                if (!existing || existing.nodeId !== node.id) {
                    sessionRef.current = createGrabbingSession(node, nodes, getEdges());
                }
            }
        } else {
            sessionRef.current = null;
            if (mode === 'IDLE') {
                // Keep reference for a few ms to allow performAutoInsert to read it
                setTimeout(() => { dragStartPosRef.current = null; }, 100);
            }
        }
    }, [mode, getNodes, getEdges]);

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
            sessionRef.current = null;
            if (highlightedEdgeId) setHighlightedEdgeId(null);
            return;
        }

        // Layer 0: rAF Guard
        if (rafId.current !== null) {
            cancelAnimationFrame(rafId.current);
        }

        rafId.current = requestAnimationFrame(() => {
            rafId.current = null;

            // Session is built once per grab (see the mode effect above); this
            // frame only refreshes the dragged node's position.
            const session = sessionRef.current;
            if (!session) {
                if (highlightedEdgeId) setHighlightedEdgeId(null);
                return;
            }

            // Single pass over the only getNodes() call of the frame; keeps the
            // old "exactly one selected node" guard without an array copy.
            let selectedCount = 0;
            let node: Node | undefined;
            for (const candidate of getNodes()) {
                if (!candidate.selected) continue;
                selectedCount++;
                if (candidate.id === session.nodeId) node = candidate;
            }

            if (selectedCount !== 1 || !node) {
                if (highlightedEdgeId) setHighlightedEdgeId(null);
                return;
            }

            // 0. Connection guard, decided once at grab start
            if (session.nodeHasEdges) {
                if (highlightedEdgeId) setHighlightedEdgeId(null);
                return;
            }

            // 1. Get Sensing Center via Red-Dot Offset (Flow Space)
            // Edge paths are drawn in flow (world) space. The absolute position
            // only moves by the node's local delta while its parent is fixed,
            // so the grab-start absolute plus that delta replaces toAbsolute.
            const cx = session.startAbsolute.x + (node.position.x - session.startPosition.x) + SENSING_OFFSET_X;
            const cy = session.startAbsolute.y + (node.position.y - session.startPosition.y) + SENSING_OFFSET_Y;

            const detRadius = DETECT_RADIUS;
            const currentPadding = highlightedEdgeId ? 110 : 100;

            const left = cx - detRadius;
            const top = cy - detRadius;
            const right = cx + detRadius;
            const bottom = cy + detRadius;

            let bestEdge: string | null = null;
            let minCenterDist = Infinity;

            // 2. Candidate prefilter (cached endpoint bbox; radius keeps the old
            //    100/110 px reach so curves that bow outside their endpoints
            //    are still considered)
            const candidateIds = pickCandidateEdgeIds(session.edgeBounds, cx, cy, currentPadding);

            for (const edgeId of candidateIds) {
                const measured = getOrMeasure(session.pathCache, edgeId, () => {
                    const edgeContainer = document.querySelector(`[data-id="${edgeId}"]`);
                    if (!edgeContainer) return null;

                    return (edgeContainer.querySelector('path.react-flow__edge-interaction') as SVGPathElement ||
                        edgeContainer.querySelector('path.react-flow__edge-path') as SVGPathElement) || null;
                });

                if (!measured) continue;

                const pathEl = measured.el;

                try {
                    const totalLength = measured.length;
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
                        bestEdge = edgeId;
                    }
                } catch (err) {}
            }

            if (bestEdge !== highlightedEdgeId) setHighlightedEdgeId(bestEdge);
        });
    }, [mode, highlightedEdgeId, getNodes, setHighlightedEdgeId]);

    const performAutoInsert = useCallback(() => {
        if (highlightedEdgeId) {
            const nodes = getNodes();
            const edges = getEdges();
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
                    id: generateEdgeId(),
                    source: sourceId,
                    sourceHandle: edge.sourceHandle,
                    target: node.id,
                    targetHandle: inputHandle,
                    type: 'magnetic',
                    data: { pathType: 'bezier' }
                };

                const e2: Edge = {
                    id: generateEdgeId(),
                    source: node.id,
                    sourceHandle: outputHandle,
                    target: targetId,
                    targetHandle: edge.targetHandle,
                    type: 'magnetic',
                    data: { pathType: 'bezier' }
                };

                const forwardTxs: Transaction[] = [
                    { type: 'DISCONNECT', payload: highlightedEdgeId },
                    { type: 'CONNECT', payload: e1 },
                    { type: 'CONNECT', payload: e2 }
                ];

                const inverseTxs: Transaction[] = [
                    { type: 'DISCONNECT', payload: e1.id },
                    { type: 'DISCONNECT', payload: e2.id },
                    { type: 'CONNECT', payload: { ...edge } }
                ];

                // If we have the starting position, wrap the node move into the inverse transaction
                if (dragStartPosRef.current) {
                    inverseTxs.push({
                        type: 'MOVE_NODE',
                        payload: { id: node.id, position: { ...dragStartPosRef.current } }
                    });
                }

                brain.applyTransaction({ type: 'BATCH', payload: forwardTxs });

                pushHistory({
                    id: `autoinsert_${Date.now()}`,
                    description: `Auto-insert ${node.id} into ${edge.id}`,
                    forward: forwardTxs,
                    inverse: inverseTxs
                });

                logAction(`Auto Insert: ${node.id} into ${edge.id}`);
            }
            setHighlightedEdgeId(null);
        }
    }, [highlightedEdgeId, brain, logAction, getNodes, getEdges, setHighlightedEdgeId, pushHistory]);

    return {
        detectAutoInsert,
        performAutoInsert,
    };
}

