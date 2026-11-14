import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow, Node, XYPosition } from '@xyflow/react';
import { useCanvasProjection } from '../useCanvasProjection';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { Transaction } from '../../engine/types/engineTypes';
import { useHistoryStore, InteractionMode as HistoryMode } from '../../store/useHistoryStore';
import { useSelection } from '../useSelection';
import { useKnife } from '../useKnife';
import { useAppStore } from '../../store/useStore';
import { resolveMouseDownAction, snapRotation, snapScale, snapTranslate } from '../../utils/transformSnap';
import { getEffectiveRoots, reparentPosition, toAbsolute, toParentLocal, validateHierarchy } from '../../utils/coordinates';
import { expandFrameToFitChildren, getNodeSize } from '../../utils/frameGeometry';
import { getFrameRect } from '../../utils/frameSelection';

type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';

/**
 * useHand — Gesture Orchestrator
 * Manages grab/scale/rotate transforms, autopan, mouse events,
 * and composes useClipboard, useSelection, useKnife.
 */
export function useHand(opts?: { snap?: boolean; isReadOnly?: boolean }) {
    const snap = opts?.snap ?? false;
    const isReadOnly = opts?.isReadOnly ?? false;
    const { getNodes, setNodes, getViewport, setViewport } = useReactFlow();
    const brain = useBrain();
    const { project } = useCanvasProjection();
    const interactionMode = useHistoryStore(s => s.interactionMode);
    const setInteractionMode = useHistoryStore(s => s.setInteractionMode);
    const pushHistory = useHistoryStore(s => s.push);
    const setIsRestoring = useHistoryStore(s => s.setIsRestoring);

    const mode = useAppStore(s => s.mode);
    const _setMode = useAppStore(s => s.setMode);
    const setTransformValue = useAppStore(s => s.setTransformValue);

    const setMode = useCallback((newMode: HistoryMode) => {
        _setMode(newMode);
        setInteractionMode(newMode);
    }, [_setMode, setInteractionMode]);

    // --- Composed Hooks ---
    const {
        deleteSelected, resetSelected,
        detachSelected, swapConnections,
        alignSelectedNodes,
        clearSelection, selectNode,
    } = useSelection({ isReadOnly });
    const { cutPath, startCut, updateCut, endCut, cancelCut } = useKnife();

    // --- Transform State ---
    const initialPositions = useRef<Map<string, XYPosition>>(new Map());
    const initialParentIds = useRef<Map<string, string | null>>(new Map());
    const initialAbsolutePositions = useRef<Map<string, XYPosition>>(new Map());
    const initialDimensions = useRef<Map<string, { w: number, h: number }>>(new Map());
    const initialRotations = useRef<Map<string, number>>(new Map());
    const frameSnapshots = useRef<Map<string, { position: XYPosition; width: number; height: number }>>(new Map());
    const childSnapshots = useRef<Map<string, { position: XYPosition; parentId: string }>>(new Map());

    const startMousePos = useRef<XYPosition | null>(null);
    const startFlowPos = useRef<XYPosition | null>(null);
    const centerRef = useRef<XYPosition | null>(null);
    const [axisLock, setAxisLock] = useState<'X' | 'Y' | null>(null);
    const lastCancelTimestamp = useRef<number>(0);

    // Numeric Transform Buffer
    const [transformBuffer, setTransformBuffer] = useState<string>('');

    // Rotation Winding
    const accumulatedRotation = useRef(0);
    const lastAngleRef = useRef(0);

    // Drag Initiation
    const pendingGrabStart = useRef<{ x: number, y: number, altKey: boolean, nodeId?: string } | null>(null);
    const isResolvingRef = useRef(false);

    // Autopan
    const mousePosRef = useRef<XYPosition | null>(null);
    const rafRef = useRef<number | null>(null);


    // --- Transform Helpers ---
    // Absolute = world (top-left). Children are parent-local; use the shared
    // coordinate contract instead of treating `position` as world.
    const getAbsolutePosition = useCallback((nodeId: string, nodeMap: Map<string, Node>): XYPosition => {
        return toAbsolute(nodeMap, nodeId);
    }, []);

    const captureFrameSnapshots = useCallback((roots: Node[], allNodes: Node[]) => {
        frameSnapshots.current.clear();
        childSnapshots.current.clear();

        const byId = new Map(allNodes.map(n => [n.id, n]));
        const frameIds = new Set<string>();
        for (const root of roots) {
            if (root.parentId && byId.get(root.parentId)?.type === 'frame') {
                frameIds.add(root.parentId);
            }
        }

        for (const frameId of frameIds) {
            const frame = byId.get(frameId);
            if (!frame) continue;
            const size = getNodeSize(frame);
            frameSnapshots.current.set(frameId, {
                position: { ...frame.position },
                width: size.w,
                height: size.h,
            });
            for (const child of allNodes.filter(n => n.parentId === frameId)) {
                childSnapshots.current.set(child.id, {
                    position: { ...child.position },
                    parentId: frameId,
                });
            }
        }
    }, []);

    const expandParentFrames = useCallback((nextNodes: Node[], currentNodes: Node[]): Node[] => {
        const currentById = new Map(currentNodes.map(n => [n.id, n]));
        const frameIds = new Set<string>();
        for (const id of initialPositions.current.keys()) {
            const parentId = currentById.get(id)?.parentId;
            if (parentId && currentById.get(parentId)?.type === 'frame') {
                frameIds.add(parentId);
            }
        }

        let result = nextNodes;
        for (const frameId of frameIds) {
            const expanded = expandFrameToFitChildren(result, frameId);
            if (expanded.changed) result = expanded.nodes;
        }
        return result;
    }, []);

    // Sanity check for finite coordinates
    const isFiniteCoord = (pos: XYPosition) => Number.isFinite(pos.x) && Number.isFinite(pos.y);



    const applyMove = useCallback((dx: number, dy: number) => {
        setNodes((currentNodes) => {
            const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
            let hasChanges = false;
            const nextNodes = currentNodes.map(n => {
                const initAbs = initialAbsolutePositions.current.get(n.id);
                const initPos = initialPositions.current.get(n.id);
                if (!initAbs && !initPos) return n;

                const nextAbs = initAbs
                    ? { x: initAbs.x + dx, y: initAbs.y + dy }
                    : { x: initPos!.x + dx, y: initPos!.y + dy };
                if (!isFiniteCoord(nextAbs)) {
                    console.warn(`[useHand] Aborted MOVE for node ${n.id} due to invalid coordinates:`, nextAbs);
                    return n;
                }

                // Frame positions may change while a child is dragged (auto-fit).
                // Convert the fixed world target back to the current parent-local space.
                const newPos = toParentLocal(nodeMap, n.id, nextAbs);
                if (Math.abs(n.position.x - newPos.x) > 0.001 || Math.abs(n.position.y - newPos.y) > 0.001) {
                    hasChanges = true;
                    return { ...n, position: newPos };
                }
                return n;
            });
            const expanded = expandParentFrames(nextNodes, currentNodes);
            return hasChanges || expanded !== nextNodes ? expanded : currentNodes;
        });
    }, [setNodes, expandParentFrames]);

    const getPivot = (nodes: Node[], nodeMap: Map<string, Node>): XYPosition => {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            const absPos = getAbsolutePosition(n.id, nodeMap);
            minX = Math.min(minX, absPos.x);
            minY = Math.min(minY, absPos.y);
            maxX = Math.max(maxX, absPos.x);
            maxY = Math.max(maxY, absPos.y);
        });

        // Pivot is now the absolute BBox Center of Top-Left (Red-Dot) points
        return {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2
        };
    };

    /**
     * Scale roots in world space, then write back parent-local coordinates.
     * Children follow their parent's translation; group scale is not a
     * rigid-body transform (we only move node origins).
     */
    const applyScale = useCallback((scaleFactor: number) => {
        const center = centerRef.current;
        if (!center) return;

        let sx = scaleFactor;
        let sy = scaleFactor;
        if (axisLock === 'X') sy = 1;
        if (axisLock === 'Y') sx = 1;

        setNodes((currentNodes) => {
            const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
            let hasChanges = false;
            const nextNodes = currentNodes.map(n => {
                const initAbsPos = initialAbsolutePositions.current.get(n.id);
                if (initAbsPos) {
                    const rx = initAbsPos.x - center.x;
                    const ry = initAbsPos.y - center.y;
                    const nextAbs = {
                        x: center.x + rx * sx,
                        y: center.y + ry * sy
                    };
                    if (!isFiniteCoord(nextAbs)) return n;

                    // Store back as parent-local; roots are unchanged by this.
                    const nextPos = toParentLocal(nodeMap, n.id, nextAbs);

                    if (Math.abs(n.position.x - nextPos.x) > 0.001 || Math.abs(n.position.y - nextPos.y) > 0.001) {
                        hasChanges = true;
                        return { ...n, position: nextPos };
                    }
                }
                return n;
            });
            const expanded = expandParentFrames(nextNodes, currentNodes);
            return hasChanges || expanded !== nextNodes ? expanded : currentNodes;
        });
    }, [setNodes, axisLock, expandParentFrames]);

    const applyRotate = useCallback((angleRad: number) => {
        const center = centerRef.current;
        if (!center) return;

        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        setNodes((currentNodes) => {
            const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
            let hasChanges = false;
            const nextNodes = currentNodes.map(n => {
                const initAbsPos = initialAbsolutePositions.current.get(n.id);
                if (initAbsPos) {
                    const dx = initAbsPos.x - center.x;
                    const dy = initAbsPos.y - center.y;

                    const nextAbs = {
                        x: center.x + (dx * cos - dy * sin),
                        y: center.y + (dx * sin + dy * cos)
                    };

                    if (!isFiniteCoord(nextAbs)) return n;

                    // Store back as parent-local; roots are unchanged by this.
                    const nextPos = toParentLocal(nodeMap, n.id, nextAbs);

                    if (Math.abs(n.position.x - nextPos.x) > 0.001 || Math.abs(n.position.y - nextPos.y) > 0.001) {
                        hasChanges = true;
                        return { ...n, position: nextPos };
                    }
                }
                return n;
            });
            const expanded = expandParentFrames(nextNodes, currentNodes);
            return hasChanges || expanded !== nextNodes ? expanded : currentNodes;
        });
    }, [setNodes, expandParentFrames]);


    // --- Interaction Core ---
    const updateInteraction = useCallback((mousePos: XYPosition, ctrlKey: boolean = false) => {
        if (mode === 'GRABBING' && startFlowPos.current) {
            if (transformBuffer !== '') return;

            const currentFlowPos = project(mousePos);
            let dx = currentFlowPos.x - startFlowPos.current.x;
            let dy = currentFlowPos.y - startFlowPos.current.y;

            if (axisLock === 'X') dy = 0;
            if (axisLock === 'Y') dx = 0;
            const config = brain.getPhysicsConfig();

            if (ctrlKey || snap) {
                const GRID_SIZE = config.interaction.snapGridSize;
                const snapped = snapTranslate(dx, dy, GRID_SIZE);
                dx = snapped.x;
                dy = snapped.y;
            }

            let displayVal = '';
            if (axisLock === 'X') displayVal = `${Math.round(dx)}`;
            else if (axisLock === 'Y') displayVal = `${Math.round(dy)}`;
            else displayVal = `${Math.round(dx)}, ${Math.round(dy)}`;

            setTransformValue(displayVal);
            applyMove(dx, dy);

        } else if (mode === 'SCALING' && startFlowPos.current && centerRef.current) {
            if (transformBuffer !== '') return;

            const currentFlowPos = project(mousePos);
            const flowStartMouse = startFlowPos.current;
            const pivot = centerRef.current;

            // Use distance from the Red-Dot (Pivot) as the scaling lever
            const startDist = Math.hypot(flowStartMouse.x - pivot.x, flowStartMouse.y - pivot.y);
            const currentDist = Math.hypot(currentFlowPos.x - pivot.x, currentFlowPos.y - pivot.y);

            const scale = startDist > 0 ? currentDist / startDist : 1;
            const appliedScale = (ctrlKey || snap) ? snapScale(scale) : scale;
            setTransformValue(appliedScale.toFixed(2));
            applyScale(appliedScale);

        } else if (mode === 'ROTATING' && startMousePos.current && centerRef.current) {
            if (transformBuffer !== '') return;

            const currentFlowPos = project(mousePos);
            const pivot = centerRef.current;

            // Mouse angle relative to the Red-Dot (Pivot)
            const currentAngle = Math.atan2(currentFlowPos.y - pivot.y, currentFlowPos.x - pivot.x);

            let delta = currentAngle - lastAngleRef.current;
            if (delta > Math.PI) delta -= 2 * Math.PI;
            if (delta < -Math.PI) delta += 2 * Math.PI;

            accumulatedRotation.current += delta;
            lastAngleRef.current = currentAngle;

            const deg = (accumulatedRotation.current * 180 / Math.PI);
            const appliedDeg = (ctrlKey || snap) ? snapRotation(deg) : deg;
            setTransformValue(appliedDeg.toFixed(1) + '°');
            applyRotate(appliedDeg * (Math.PI / 180));
        }
    }, [mode, project, axisLock, transformBuffer, applyMove, applyScale, applyRotate, snap]);

    // --- Autopan Loop ---
    const autopan = useCallback(function autopanLoop() {
        if (!['GRABBING', 'SCALING', 'ROTATING'].includes(mode) || !mousePosRef.current) {
            rafRef.current = null;
            return;
        }

        const { x, y } = mousePosRef.current;
        const config = brain.getPhysicsConfig();
        const pad = config.interaction.autoPanPadding;
        const w = window.innerWidth;
        const h = window.innerHeight;

        let panX = 0;
        let panY = 0;

        const getSpeed = (dist: number) => {
            const normalized = Math.max(0, dist / pad);
            return Math.pow(normalized, 1.5) * config.interaction.autoPanBaseSpeed;
        };

        if (x < pad) panX = getSpeed(pad - x);
        else if (x > w - pad) panX = -getSpeed(x - (w - pad));

        if (y < pad) panY = getSpeed(pad - y);
        else if (y > h - pad) panY = -getSpeed(y - (h - pad));

        if (panX !== 0 || panY !== 0) {
            const vp = getViewport();
            setViewport({ ...vp, x: vp.x + panX, y: vp.y + panY });
            updateInteraction(mousePosRef.current);
        }

        rafRef.current = requestAnimationFrame(autopanLoop);
    }, [mode, getViewport, setViewport, updateInteraction]);

    useEffect(() => {
        if (['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) {
            rafRef.current = requestAnimationFrame(autopan);
        } else if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [mode, autopan]);


    // --- Interaction Triggers ---
    const startGrab = useCallback((mousePos: XYPosition, isAltHeld: boolean = false, overrideNodes?: Node[], isExplicit: boolean = false, targetId?: string) => {
        const liveNodes = getNodes();
        // Duplicate (Shift+D) hands us nodes that the React Flow store has not
        // projected yet (the Brain transaction is still in flight). They must be
        // part of the node universe, otherwise `getEffectiveRoots` finds nothing
        // and the grab never starts — the duplicate would just sit at its paste
        // offset instead of following the mouse.
        let nodes = liveNodes;
        if (overrideNodes && overrideNodes.length > 0) {
            const byId = new Map(liveNodes.map(n => [n.id, n]));
            for (const node of overrideNodes) byId.set(node.id, node);
            nodes = Array.from(byId.values());
        }
        let selected: Node[] = [];

        if (overrideNodes) {
            selected = overrideNodes;
        } else {
            selected = nodes.filter(n => n.selected);
        }

        // Filter out Reroute nodes if not an explicit G move or override nodes
        if (!isExplicit && !overrideNodes) {
            selected = selected.filter(n => n.type !== 'UT-02');
        }

        if (selected.length === 0) return;

        if (isAltHeld && !overrideNodes) {
            detachSelected();
        }

        // If the user grabbed a child while its frame is also selected, the
        // child is the transform target; the frame must not move with it.
        const clicked = targetId ? nodes.find(n => n.id === targetId) : undefined;
        const transformSelected = clicked?.parentId
            ? selected.filter(n => n.id !== clicked.parentId)
            : selected;

        // Only move the roots of the selection. A selected child whose parent is
        // also selected follows the parent's transform; writing both would move
        // it twice (and corrupt local coordinates).
        const roots = getEffectiveRoots(nodes, new Set(transformSelected.map(n => n.id)));
        if (roots.length === 0) return;

        captureFrameSnapshots(roots, nodes);
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        initialPositions.current = new Map(roots.map((n) => [n.id, { ...n.position }]));
        initialParentIds.current = new Map(roots.map((n) => [n.id, n.parentId || null]));
        initialAbsolutePositions.current = new Map(roots.map((n) => [
            n.id,
            getAbsolutePosition(n.id, nodeMap)
        ]));
        initialDimensions.current.clear();
        initialRotations.current.clear();
        startMousePos.current = mousePos;
        startFlowPos.current = project(mousePos);
        setAxisLock(null);
        brain.setInteracting(true); // Wake up Pulse
        setMode('GRABBING');
    }, [getNodes, getAbsolutePosition, detachSelected, project, setMode, brain]);

    const startScale = useCallback((mousePos: XYPosition) => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        const roots = getEffectiveRoots(nodes, new Set(selected.map(n => n.id)));
        if (roots.length === 0) return;

        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        captureFrameSnapshots(roots, nodes);

        // Store RELATIVE positions for restore/undo
        initialPositions.current = new Map(roots.map((n) => [n.id, { ...n.position }]));
        initialParentIds.current = new Map(roots.map((n) => [n.id, n.parentId || null]));

        // Store ABSOLUTE positions for calculation
        initialAbsolutePositions.current = new Map(roots.map((n) => [
            n.id,
            getAbsolutePosition(n.id, nodeMap)
        ]));

        initialRotations.current = new Map(roots.map((n) => [
            n.id,
            (n.data?.rotation as number) || 0
        ]));

        // Store Dimensions for stability
        initialDimensions.current = new Map(roots.map((n) => [
            n.id,
            {
                w: n.width ?? n.measured?.width ?? 150,
                h: n.height ?? n.measured?.height ?? 50
            }
        ]));

        centerRef.current = getPivot(roots, nodeMap);
        startMousePos.current = mousePos;
        startFlowPos.current = project(mousePos);
        brain.setInteracting(true); // Wake up Pulse
        setMode('SCALING');
    }, [getNodes, project, getAbsolutePosition, brain]);

    const startRotate = useCallback((mousePos: XYPosition) => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        const roots = getEffectiveRoots(nodes, new Set(selected.map(n => n.id)));
        if (roots.length === 0) return;

        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        captureFrameSnapshots(roots, nodes);

        // Store RELATIVE positions for restore/undo
        initialPositions.current = new Map(roots.map((n) => [n.id, { ...n.position }]));
        initialParentIds.current = new Map(roots.map((n) => [n.id, n.parentId || null]));

        // Store ABSOLUTE positions for calculation
        initialAbsolutePositions.current = new Map(roots.map((n) => [
            n.id,
            getAbsolutePosition(n.id, nodeMap)
        ]));

        initialRotations.current = new Map(roots.map((n) => [
            n.id,
            (n.data?.rotation as number) || 0
        ]));

        // Store Dimensions for stability
        initialDimensions.current = new Map(roots.map((n) => [
            n.id,
            {
                w: n.width ?? n.measured?.width ?? 150,
                h: n.height ?? n.measured?.height ?? 50
            }
        ]));

        centerRef.current = getPivot(roots, nodeMap);

        const flowStartMouse = project({ x: mousePos.x, y: mousePos.y });
        accumulatedRotation.current = 0;

        // Calculate initial angle relative to centroid
        // Both flowStartMouse and centerRef.current are in absolute coordinates now ??
        // Wait, flowStartMouse is projected from screen to flow. is flow absolute?
        // Yes, project() returns flow coordinates (absolute).
        lastAngleRef.current = Math.atan2(
            flowStartMouse.y - centerRef.current.y,
            flowStartMouse.x - centerRef.current.x
        );

        startMousePos.current = mousePos;
        brain.setInteracting(true); // Wake up Pulse
        setMode('ROTATING');
    }, [getNodes, project, getAbsolutePosition, brain]);

    const confirmGrab = useCallback(() => {
        const nodes = getNodes();
        const txs: Transaction[] = [];
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Helper: get node dimensions safely
        const getSize = (n: Node) => ({
            w: n.width ?? n.measured?.width ?? (n.data?.width as number) ?? (n.data?._dataWidth as number) ?? 150,
            h: n.height ?? n.measured?.height ?? (n.data?.height as number) ?? (n.data?._dataHeight as number) ?? 50,
        });

        // 1. Identify moved or resized nodes
        const movedNodeIds = new Set<string>();
        initialPositions.current.forEach((initPos, id) => {
            const node = nodeMap.get(id);
            if (node) {
                const initDim = initialDimensions.current.get(id);
                const { w, h } = getSize(node);
                const dw = initDim ? Math.abs(w - initDim.w) : 0;
                const dh = initDim ? Math.abs(h - initDim.h) : 0;
                const dx = Math.abs(node.position.x - initPos.x);
                const dy = Math.abs(node.position.y - initPos.y);

                if (dx > 0.1 || dy > 0.1 || dw > 0.1 || dh > 0.1) {
                    movedNodeIds.add(id);
                }
            }
        });

        const frameSnapshotChanged = (() => {
            for (const [frameId, before] of frameSnapshots.current) {
                const frame = nodeMap.get(frameId);
                if (!frame) continue;
                const size = getSize(frame);
                if (
                    Math.abs(frame.position.x - before.position.x) > 0.1 ||
                    Math.abs(frame.position.y - before.position.y) > 0.1 ||
                    Math.abs(size.w - before.width) > 0.1 ||
                    Math.abs(size.h - before.height) > 0.1
                ) return true;
            }
            for (const [childId, before] of childSnapshots.current) {
                const child = nodeMap.get(childId);
                if (!child) continue;
                if (
                    Math.abs(child.position.x - before.position.x) > 0.1 ||
                    Math.abs(child.position.y - before.position.y) > 0.1
                ) return true;
            }
            return false;
        })();

        if (movedNodeIds.size === 0 && !frameSnapshotChanged) {
            console.log(`[Hand] confirmGrab: No nodes moved significantly.`);
            setMode('IDLE');
            initialPositions.current.clear();
            initialParentIds.current.clear();
            frameSnapshots.current.clear();
            childSnapshots.current.clear();
            initialAbsolutePositions.current.clear();
            initialDimensions.current.clear();
            initialRotations.current.clear();
            startMousePos.current = null;
            startFlowPos.current = null;
            centerRef.current = null;
            setAxisLock(null);
            setTransformBuffer('');
            setTransformValue('');
            return;
        }

        // 2. Build transactions (Position Only)
        // Drop-to-attach: a root whose full rect is inside a frame becomes its child.
        const attachments = new Map<string, string>();
        // Single level: only a root frame may be a parent.
        const frames = nodes.filter(n => n.type === 'frame' && !n.parentId);
        if (frames.length > 0) {
            // Hierarchy guard: validate the proposed graph (not just the pair) so
            // a candidate with descendants cannot create depth > 1. Issues that
            // already existed before this drag are ignored; only new violations
            // reject the attach.
            const hierarchyNodes = nodes.map(n => ({
                id: n.id,
                position: n.position,
                parentId: n.parentId ?? undefined,
            }));
            const issueKey = (issue: { code: string; nodeId: string; parentId?: string }) =>
                `${issue.code}:${issue.nodeId}:${issue.parentId ?? ''}`;
            const existingIssues = new Set(
                validateHierarchy(hierarchyNodes, { maxDepth: 1 }).map(issueKey)
            );

            for (const id of movedNodeIds) {
                const node = nodeMap.get(id);
                if (!node || node.type === 'frame' || node.parentId) continue;

                const abs = toAbsolute(nodeMap, id);
                const size = getSize(node);
                let best: Node | undefined;
                let bestArea = Infinity;

                for (const frame of frames) {
                    const rect = getFrameRect(frame);
                    const contains =
                        abs.x >= rect.x &&
                        abs.y >= rect.y &&
                        abs.x + size.w <= rect.x + rect.width &&
                        abs.y + size.h <= rect.y + rect.height;
                    if (!contains) continue;
                    const area = rect.width * rect.height;
                    if (area < bestArea) {
                        best = frame;
                        bestArea = area;
                    }
                }

                if (!best) continue;

                const index = hierarchyNodes.findIndex(n => n.id === id);
                if (index < 0) continue;

                const proposed = hierarchyNodes.map((n, i) =>
                    i === index ? { ...n, parentId: best!.id } : n
                );
                const violations = validateHierarchy(proposed, { maxDepth: 1 })
                    .filter(issue => !existingIssues.has(issueKey(issue)));
                if (violations.length > 0) {
                    console.warn(
                        `[useHand] Attach rejected: ${id} -> ${best.id}. ${violations.map(v => v.message).join(' ')}`
                    );
                    continue;
                }

                attachments.set(id, best.id);
            }
        }

        movedNodeIds.forEach(id => {
            const node = nodeMap.get(id);
            if (!node || !isFiniteCoord(node.position)) {
                console.warn(`[useHand] Aborted final transaction for node ${id} due to invalid coordinates.`);
                return;
            }

            // Roots only: a selected child's parent is never in movedNodeIds,
            // so every entry here owns its local position change.
            const attachFrameId = attachments.get(id);
            let position = { ...node.position };
            let parentId: string | undefined;
            if (attachFrameId) {
                const abs = toAbsolute(nodeMap, id);
                const local = reparentPosition(nodeMap, id, attachFrameId, abs);
                if (local) {
                    position = local;
                    parentId = attachFrameId;
                } else {
                    console.warn(`[useHand] Aborted attach for node ${id} -> frame ${attachFrameId}: invalid hierarchy.`);
                }
            }
            txs.push({
                type: 'MOVE_NODE',
                payload: { id, position, ...(parentId ? { parentId } : {}) },
            });
        });

        // 3. Frame auto-fit: if a child left its frame, the UI was expanded live.
        // Persist the frame move/resize and every child whose local origin shifted.
        const frameForward: Transaction[] = [];
        const frameInverse: Transaction[] = [];
        const frameChildIds = new Set<string>();
        let frameChanged = false;

        for (const [frameId, before] of frameSnapshots.current) {
            const frame = nodeMap.get(frameId);
            if (!frame) continue;
            const size = getSize(frame);
            const moved =
                Math.abs(frame.position.x - before.position.x) > 0.1 ||
                Math.abs(frame.position.y - before.position.y) > 0.1;
            const resized =
                Math.abs(size.w - before.width) > 0.1 ||
                Math.abs(size.h - before.height) > 0.1;

            if (moved) {
                frameForward.push({ type: 'MOVE_NODE', payload: { id: frameId, position: { ...frame.position } } });
                frameInverse.push({ type: 'MOVE_NODE', payload: { id: frameId, position: { ...before.position } } });
                frameChanged = true;
            }
            if (resized) {
                frameForward.push({ type: 'RESIZE_NODE', payload: { id: frameId, width: size.w, height: size.h } });
                frameInverse.push({ type: 'RESIZE_NODE', payload: { id: frameId, width: before.width, height: before.height } });
                frameChanged = true;
            }
        }

        for (const [childId, before] of childSnapshots.current) {
            const child = nodeMap.get(childId);
            if (!child) continue;
            frameChildIds.add(childId);

            const changed =
                Math.abs(child.position.x - before.position.x) > 0.1 ||
                Math.abs(child.position.y - before.position.y) > 0.1 ||
                (child.parentId ?? null) !== before.parentId;
            if (!changed) continue;

            frameForward.push({
                type: 'MOVE_NODE',
                payload: { id: childId, position: { ...child.position }, parentId: before.parentId },
            });
            frameInverse.push({
                type: 'MOVE_NODE',
                payload: { id: childId, position: { ...before.position }, parentId: before.parentId },
            });
        }

        if (txs.length > 0 || frameChanged) {
            const forward = frameChanged
                ? [
                    ...frameForward,
                    ...txs.filter(tx => !(tx.type === 'MOVE_NODE' && frameChildIds.has((tx.payload as any).id))),
                ]
                : txs;

            brain.applyTransaction({ type: 'BATCH', payload: forward });

            const invTxs: Transaction[] = [];
            // FIX: Use initialPositions as the source of truth for all transformations (Grab/Scale/Rotate)
            // initialAbsolutePositions is only populated for Scale/Rotate and is used for calculation, not history.
            initialPositions.current.forEach((initPos, id) => {
                if (!isFiniteCoord(initPos)) return; // History Guard
                if (frameChildIds.has(id)) return; // frameInverse owns this child

                const initialParentId = initialParentIds.current.get(id);
                const payload: { id: string; position: XYPosition; parentId?: string | null } = {
                    id,
                    position: { ...initPos },
                };
                // Restore the original parent. null explicitly detaches a node
                // that was newly attached to a frame during this transform.
                if (initialParentIds.current.has(id)) {
                    payload.parentId = initialParentId ?? null;
                }

                invTxs.push({ type: 'MOVE_NODE', payload });
            });

            initialDimensions.current.forEach((initDim, id) => {
                if (frameChildIds.has(id)) return;
                const w = Number.isFinite(initDim.w) ? initDim.w : 150;
                const h = Number.isFinite(initDim.h) ? initDim.h : 50;
                invTxs.push({ type: 'UPDATE_NODE_DATA', payload: { id, data: { width: w, height: h } } });
            });

            const inverse = frameChanged ? [...frameInverse, ...invTxs] : invTxs;
            console.log(`[Hand] Pushing history: Transform ${forward.length} items`, { forward, inverse });
            pushHistory({
                id: `transform_${Date.now()}`,
                description: `Transform ${forward.length} items`,
                forward,
                inverse
            });
        }

        isResolvingRef.current = true;
        setTimeout(() => { isResolvingRef.current = false; }, 100);

        setMode('IDLE');
        initialPositions.current.clear();
        initialParentIds.current.clear();
        frameSnapshots.current.clear();
        childSnapshots.current.clear();
        initialDimensions.current.clear();
        initialRotations.current.clear();
        initialAbsolutePositions.current.clear();

        startMousePos.current = null;
        startFlowPos.current = null;
        centerRef.current = null;
        setAxisLock(null);
        setTransformBuffer('');
        setTransformValue('');
    }, [getNodes, getAbsolutePosition, setNodes, pushHistory, setMode]);

    const cancelGrab = useCallback((suppressMenu: boolean = false) => {
        if (suppressMenu) {
            lastCancelTimestamp.current = Date.now();
        }

        const positionsToRestore = new Map(initialPositions.current);
        const frameSnapshotsToRestore = new Map(frameSnapshots.current);
        const childSnapshotsToRestore = new Map(childSnapshots.current);

        if (
            positionsToRestore.size === 0 &&
            frameSnapshotsToRestore.size === 0 &&
            childSnapshotsToRestore.size === 0
        ) {
            setMode('IDLE');
            initialPositions.current.clear();
            initialParentIds.current.clear();
            frameSnapshots.current.clear();
            childSnapshots.current.clear();
            initialAbsolutePositions.current.clear();
            initialDimensions.current.clear();
            initialRotations.current.clear();
            startMousePos.current = null;
            startFlowPos.current = null;
            centerRef.current = null;
            setAxisLock(null);
            setTransformBuffer('');
            setTransformValue('');
            return;
        }

        // Sync protection: Prevent cancelGrab from generating polluting history in useBrainSync
        setIsRestoring(true);
        setNodes(currentNodes => {
            let hasChanges = false;
            const nextNodes = currentNodes.map(n => {
                // Restore the frame first; its children are restored below.
                const frame = frameSnapshotsToRestore.get(n.id);
                if (frame) {
                    hasChanges = true;
                    return {
                        ...n,
                        position: { ...frame.position },
                        width: frame.width,
                        height: frame.height,
                        data: { ...n.data, width: frame.width, height: frame.height },
                    };
                }

                // Restore every child whose local origin shifted during auto-fit.
                const child = childSnapshotsToRestore.get(n.id);
                if (child) {
                    hasChanges = true;
                    return {
                        ...n,
                        position: { ...child.position },
                        parentId: child.parentId,
                    };
                }

                // Restore root positions.
                const initPos = positionsToRestore.get(n.id);
                if (initPos) {
                    // Fast path ref-equality
                    if (Math.abs(n.position.x - initPos.x) < 0.001 && Math.abs(n.position.y - initPos.y) < 0.001) {
                        return n;
                    }
                    hasChanges = true;
                    const initialParentId = initialParentIds.current.get(n.id);
                    const res = {
                        ...n,
                        position: { ...initPos }
                    };
                    if (initialParentId !== undefined) res.parentId = initialParentId === null ? undefined : initialParentId;
                    return res;
                }
                return n;
            });
            return hasChanges ? nextNodes : currentNodes;
        });

        // Double rAF to ensure sync completes before releasing guard
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setIsRestoring(false);
            });
        });

        isResolvingRef.current = true;
        setTimeout(() => { isResolvingRef.current = false; }, 100);

        setMode('IDLE');
        initialPositions.current.clear();
        initialParentIds.current.clear();
        frameSnapshots.current.clear();
        childSnapshots.current.clear();
        initialDimensions.current.clear();
        initialRotations.current.clear();
        initialAbsolutePositions.current.clear();

        startMousePos.current = null;
        startFlowPos.current = null;
        centerRef.current = null;
        setAxisLock(null);
        setTransformBuffer('');
        setTransformValue('');
    }, [setNodes, setMode]);


    // --- Event Handlers ---
    const handleMouseDown = useCallback((e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.react-flow__handle') || target.closest('.react-flow__edge')) return;
        if (target.closest('.nodrag')) return; // Ignore custom drag if clicking on a protected area

        // Block movement if clicking on interactive elements
        const tagName = target.tagName.toUpperCase();
        if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A', 'LABEL'].includes(tagName)) return;

        const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
        const mouseAction = resolveMouseDownAction({ button: e.button, ctrlKey: e.ctrlKey, isMac, mode });

        if (mouseAction === 'CANCEL') {
            cancelGrab(true);
            cancelCut();
            return;
        }
        if (mouseAction === 'CUT') {
            setMode('CUTTING');
            startCut({ x: e.clientX, y: e.clientY });
            return;
        }
        // Note: React Flow uses button 1 for middle-click and 2 for right-click in panOnDrag
        if (e.button === 1 || e.button === 2) return;

        // Panning Guard: If middle-click (1) or space+left-click (0 with specific class)
        // We also check for the flow pane specifically to avoid node-click triggering this.
        const isMiddleClick = e.button === 1;
        const isFlowPane = target.classList.contains('react-flow__pane');
        if (isMiddleClick || (e.button === 0 && isFlowPane)) {
            brain.setInteracting(true);
        }

        if (e.button === 0) {
            const nodeElement = target.closest('.react-flow__node');
            if (nodeElement) {
                const nodeId = nodeElement.getAttribute('data-id');
                if (nodeId) {
                    const nodes = getNodes();
                    const clickedNode = nodes.find(n => n.id === nodeId);
                    if (clickedNode) {
                        if (!e.shiftKey) {
                            if (!clickedNode.selected) selectNode(nodeId, true);
                        } else {
                            selectNode(nodeId, false);
                        }
                        pendingGrabStart.current = { x: e.clientX, y: e.clientY, altKey: e.altKey, nodeId };
                    }
                }
            }
        }
    }, [startCut, cancelCut, cancelGrab, getNodes, selectNode, mode, setMode]);
    // rAF throttle to prevent high-frequency gaming mouse from destroying React Flow performance
    const dragRafRef = useRef<number | null>(null);
    useEffect(() => {
        return () => {
            if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
        };
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const currentMousePos = { x: e.clientX, y: e.clientY };
        mousePosRef.current = currentMousePos;

        if (mode === 'IDLE' && pendingGrabStart.current) {
            const dist = Math.hypot(
                currentMousePos.x - pendingGrabStart.current.x,
                currentMousePos.y - pendingGrabStart.current.y
            );
            const config = brain.getPhysicsConfig();
            if (dist > config.interaction.dragThreshold) {
                let overrideNodes: Node[] | undefined = undefined;

                // Handle "Direct Grab": If the clicked node is not yet selected in UI 
                // (due to React state lag), we force-inject it as the grab target.
                const nodeId = pendingGrabStart.current.nodeId;
                if (nodeId) {
                    const uiNodes = getNodes();
                    const clickedNode = uiNodes.find(n => n.id === nodeId);
                    if (clickedNode && !clickedNode.selected) {
                        overrideNodes = [clickedNode];
                        // Persist Selection: Officially record the selection in Brain 
                        // so it doesn't revert to unselected on MouseUp reconciliation.
                        selectNode(nodeId, true);
                    }
                }

                startGrab(pendingGrabStart.current, pendingGrabStart.current.altKey, overrideNodes, false, pendingGrabStart.current.nodeId);
                pendingGrabStart.current = null;
                return;
            }
        }

        if (dragRafRef.current !== null) return;

        dragRafRef.current = requestAnimationFrame(() => {
            dragRafRef.current = null;
            if (mode === 'CUTTING') {
                updateCut(currentMousePos);
            } else {
                updateInteraction(currentMousePos, e.ctrlKey);
            }
        });
    }, [mode, updateCut, updateInteraction, startGrab, brain]);

    // --- Modal Action Logic ---
    const handleModalMouseUp = useCallback((e: MouseEvent) => {
        const isTransformMode = ['GRABBING', 'SCALING', 'ROTATING'].includes(mode);
        if (!isTransformMode) return;

        if (e.button === 0) {
            confirmGrab();
        } else if (e.button === 2) {
            cancelGrab(true); // Right-click cancel suppresses next menu
        }
    }, [mode, confirmGrab, cancelGrab]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        // ... (Click-to-Select logic unchanged)
        if (mode === 'IDLE' && pendingGrabStart.current) {
            const target = e.target as HTMLElement;
            const nodeElement = target.closest('.react-flow__node');
            if (nodeElement) {
                const nodeId = nodeElement.getAttribute('data-id');
                if (nodeId && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                    selectNode(nodeId, true);
                }
            }
        }

        pendingGrabStart.current = null;
        if (mode === 'CUTTING') {
            endCut();
            setMode('IDLE');
        } else {
            // End of any interaction (including panning/dragging)
            brain.setInteracting(false);
            handleModalMouseUp(e);
        }
    }, [mode, endCut, handleModalMouseUp, selectNode, brain]);

    // Prevent context menu during transform modes to allow right-click cancel
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            if (['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) {
                e.preventDefault();
            }
        };
        window.addEventListener('contextmenu', handleContextMenu);
        return () => window.removeEventListener('contextmenu', handleContextMenu);
    }, [mode]);

    // Failsafe: Cleanup interaction guard on global blur or mouse leave
    useEffect(() => {
        const resetGuard = () => brain.setInteracting(false);
        window.addEventListener('blur', resetGuard);
        window.addEventListener('mouseleave', resetGuard);
        return () => {
            window.removeEventListener('blur', resetGuard);
            window.removeEventListener('mouseleave', resetGuard);
        };
    }, [brain]);

    const handleTypeNum = useCallback((char: string) => {
        if (!['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) return;
        setTransformBuffer(prev => {
            if (char === 'Backspace') return prev.slice(0, -1);
            if (char === '.' && prev.includes('.')) return prev;
            if (char === '-' && prev.includes('-')) return prev.replace('-', '');
            if (char === '-' && !prev.includes('-')) return '-' + prev;
            return prev + char;
        });
    }, [mode]);

    useEffect(() => {
        if (transformBuffer === '' && mode !== 'IDLE') return;
        const val = parseFloat(transformBuffer);
        if (isNaN(val)) return;
        setTransformValue(transformBuffer);
        if (mode === 'GRABBING') {
            let dx = 0, dy = 0;
            if (axisLock === 'Y') dy = val;
            else dx = val;
            applyMove(dx, dy);
        } else if (mode === 'SCALING') {
            applyScale(val);
        } else if (mode === 'ROTATING') {
            applyRotate(val * (Math.PI / 180));
        }
    }, [transformBuffer, mode, axisLock, applyMove, applyScale, applyRotate]);

    return {
        mode,
        cutPath,
        cancelCut,
        transformBuffer,
        startGrab,
        startScale,
        startRotate,
        confirmGrab,
        cancelGrab,

        deleteSelected,
        resetSelected,
        swapConnections,
        detachSelected,
        alignSelectedNodes,
        clearSelection,
        selectNode,
        setAxisLock,
        handleTypeNum,
        handleMouseMove,
        handleMouseDown,
        handleMouseUp,
        lastCancelTimestamp,
        isResolvingTransform: () => isResolvingRef.current
    };
}

