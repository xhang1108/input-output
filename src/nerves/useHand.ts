import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow, Node, XYPosition } from '@xyflow/react';
import { useCanvasProjection } from '../hooks/useCanvasProjection';
import { Brain } from '../engine/Brain';
import { Transaction } from '../engine/types';
import { useClipboard } from './useClipboard';
import { useSelection } from './useSelection';
import { useKnife } from './useKnife';

type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';

/**
 * useHand — Gesture Orchestrator
 * Manages grab/scale/rotate transforms, autopan, mouse events,
 * and composes useClipboard, useSelection, useKnife.
 */
export function useHand() {
    const { getNodes, setNodes, getViewport, setViewport } = useReactFlow();
    const { project } = useCanvasProjection();
    const [mode, setMode] = useState<InteractionMode>('IDLE');

    // --- Composed Hooks ---
    const { duplicateSelected, copyToClipboard, pasteFromClipboard } = useClipboard();
    const {
        deleteSelected, resetSelected, bundleSelected,
        detachSelected, swapConnections,
        clearSelection, selectNode,
    } = useSelection();
    const { cutPath, startCut, updateCut, endCut } = useKnife();

    // --- Transform State ---
    const initialPositions = useRef<Map<string, XYPosition>>(new Map());
    const initialAbsolutePositions = useRef<Map<string, XYPosition>>(new Map());
    const initialDimensions = useRef<Map<string, { w: number, h: number }>>(new Map());
    const initialFrameStates = useRef<Map<string, Node>>(new Map());
    const startMousePos = useRef<XYPosition | null>(null);
    const startFlowPos = useRef<XYPosition | null>(null);
    const centerRef = useRef<XYPosition | null>(null);
    const [axisLock, setAxisLock] = useState<'X' | 'Y' | null>(null);

    // Numeric Transform Buffer
    const [transformBuffer, setTransformBuffer] = useState<string>('');
    const [transformValue, setTransformValue] = useState<string>('');

    // Rotation Winding
    const accumulatedRotation = useRef(0);
    const lastAngleRef = useRef(0);

    // Drag Initiation
    const pendingGrabStart = useRef<{ x: number, y: number, altKey: boolean } | null>(null);
    const isResolvingRef = useRef(false);

    // Autopan
    const mousePosRef = useRef<XYPosition | null>(null);
    const rafRef = useRef<number | null>(null);
    const modifiedFrameIds = useRef<Set<string>>(new Set());
    const initialParentPositions = useRef<Map<string, XYPosition>>(new Map());
    const initialFrameChildrenStates = useRef<Map<string, Node>>(new Map());

    // --- Transform Helpers ---
    const getAbsolutePosition = useCallback(function getAbs(nodeId: string, nodeMap: Map<string, Node>): XYPosition {
        const node = nodeMap.get(nodeId);
        if (!node) return { x: 0, y: 0 };
        if (!node.parentId) return node.position;

        const parentPos = getAbs(node.parentId, nodeMap);
        const parentNode = nodeMap.get(node.parentId);
        const parentW = Number(parentNode?.measured?.width ?? parentNode?.width ?? parentNode?.data?.width ?? 0);
        const parentH = Number(parentNode?.measured?.height ?? parentNode?.height ?? parentNode?.data?.height ?? 0);

        return {
            x: parentPos.x - parentW / 2 + node.position.x,
            y: parentPos.y - parentH / 2 + node.position.y
        };
    }, []);

    const updateParentFrames = useCallback((nodeMap: Map<string, Node>, affectedParentIds: Set<string>) => {
        affectedParentIds.forEach(parentId => {
            const parent = nodeMap.get(parentId);
            if (!parent || parent.type !== 'frame') return;

            const children = Array.from(nodeMap.values()).filter(n => n.parentId === parentId);
            if (children.length === 0) return;

            let minAbsX = Infinity, minAbsY = Infinity;
            let maxAbsX = -Infinity, maxAbsY = -Infinity;

            const oldWidth = Number(parent.measured?.width ?? parent.width ?? parent.data?.width ?? 0);
            const oldHeight = Number(parent.measured?.height ?? parent.height ?? parent.data?.height ?? 0);
            const parentTL_X = parent.position.x - oldWidth / 2, parentTL_Y = parent.position.y - oldHeight / 2;

            children.forEach(child => {
                const w = Number(child.measured?.width ?? child.width ?? 150), h = Number(child.measured?.height ?? child.height ?? 50);
                const absCX = parentTL_X + child.position.x, absCY = parentTL_Y + child.position.y;
                minAbsX = Math.min(minAbsX, absCX - w / 2); minAbsY = Math.min(minAbsY, absCY - h / 2);
                maxAbsX = Math.max(maxAbsX, absCX + w / 2); maxAbsY = Math.max(maxAbsY, absCY + h / 2);
            });

            const PAD = 40, TOP_PAD = 40;
            const newAbsTL_X = minAbsX - PAD, newAbsTL_Y = minAbsY - TOP_PAD;
            const newW = (maxAbsX + PAD) - newAbsTL_X, newH = (maxAbsY + PAD) - newAbsTL_Y;
            const newAbsCX = newAbsTL_X + newW / 2, newAbsCY = newAbsTL_Y + newH / 2;

            const diffX = newAbsCX - parent.position.x, diffY = newAbsCY - parent.position.y;
            const diffW = newW - oldWidth, diffH = newH - oldHeight;

            if (Math.abs(diffX) > 0.01 || Math.abs(diffY) > 0.01 || Math.abs(diffW) > 0.01 || Math.abs(diffH) > 0.01) {
                if (!initialFrameStates.current.has(parentId)) {
                    initialFrameStates.current.set(parentId, { ...parent });
                    children.forEach(c => { if (!initialPositions.current.has(c.id)) initialFrameChildrenStates.current.set(c.id, { ...c }); });
                }
                modifiedFrameIds.current.add(parentId);

                const newParent = {
                    ...parent,
                    position: { x: newAbsCX, y: newAbsCY },
                    width: newW, height: newH, measured: { width: newW, height: newH },
                    style: { ...parent.style, width: newW, height: newH },
                    data: { ...parent.data, width: newW, height: newH }
                };
                nodeMap.set(parentId, newParent);

                const shiftX = newAbsTL_X - parentTL_X, shiftY = newAbsTL_Y - parentTL_Y;
                if (Math.abs(shiftX) > 0.01 || Math.abs(shiftY) > 0.01) {
                    children.forEach(child => {
                        nodeMap.set(child.id, { ...child, position: { x: child.position.x - shiftX, y: child.position.y - shiftY } });
                    });
                }
            }
        });
    }, []);

    const applyMove = useCallback((dx: number, dy: number) => {
        setNodes((currentNodes) => {
            const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
            const affectedParentIds = new Set<string>();

            // 0. Reset modified frames and their unmodified children to initial state 
            modifiedFrameIds.current.forEach(id => {
                const initFrame = initialFrameStates.current.get(id);
                if (initFrame) nodeMap.set(id, { ...initFrame });
            });
            initialFrameChildrenStates.current.forEach((initChild, id) => {
                nodeMap.set(id, { ...initChild });
            });

            // 1. Update Moved Nodes
            initialPositions.current.forEach((initPos, id) => {
                const node = nodeMap.get(id);
                if (node) {
                    let newX = initPos.x + dx;
                    let newY = initPos.y + dy;

                    // Compensation for Parent Movement (only needed if dragging a node nested inside a moving parent)
                    if (node.parentId) {
                        const initParentPos = initialParentPositions.current.get(node.parentId);
                        const currentParent = nodeMap.get(node.parentId);

                        // If parent has moved from initial, we must adjust the relative child pos
                        if (initParentPos && currentParent) {
                            const parentW = Number(currentParent.width ?? currentParent.data?.width ?? 0);
                            const parentH = Number(currentParent.height ?? currentParent.data?.height ?? 0);

                            const initParentTL_X = initParentPos.x - parentW / 2;
                            const initParentTL_Y = initParentPos.y - parentH / 2;

                            const absTargetX = initParentTL_X + initPos.x + dx;
                            const absTargetY = initParentTL_Y + initPos.y + dy;

                            const currParentTL_X = currentParent.position.x - parentW / 2;
                            const currParentTL_Y = currentParent.position.y - parentH / 2;

                            newX = absTargetX - currParentTL_X;
                            newY = absTargetY - currParentTL_Y;
                        }
                    }

                    const newPos = { x: newX, y: newY };
                    nodeMap.set(id, { ...node, position: newPos, measured: node.measured });
                    if (node.parentId) affectedParentIds.add(node.parentId);
                }
            });

            // 2. Real-time Frame Auto-Resize
            updateParentFrames(nodeMap, affectedParentIds);

            return Array.from(nodeMap.values());
        });
    }, [setNodes, updateParentFrames]);

    const getCentroid = (nodes: Node[], nodeMap: Map<string, Node>): XYPosition => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            const absPos = getAbsolutePosition(n.id, nodeMap);
            const w = n.measured?.width ?? 150;
            const h = n.measured?.height ?? 50;
            minX = Math.min(minX, absPos.x - w / 2);
            maxX = Math.max(maxX, absPos.x + w / 2);
            minY = Math.min(minY, absPos.y - h / 2);
            maxY = Math.max(maxY, absPos.y + h / 2);
        });
        return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    };

    const applyScale = useCallback((scaleFactor: number) => {
        const center = centerRef.current;
        if (!center) return;

        let sx = scaleFactor;
        let sy = scaleFactor;
        if (axisLock === 'X') sy = 1;
        if (axisLock === 'Y') sx = 1;

        setNodes((nodes) => {
            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            const newAbsolutePositions = new Map<string, XYPosition>();
            const newDimensions = new Map<string, { w: number, h: number }>();

            // Determine intention: single node resize vs multi-node spread
            const selectedIds = Array.from(initialAbsolutePositions.current.keys());
            const isSingleScale = selectedIds.length === 1;

            // 1. Calculate new ABSOLUTE positions (and dimensions if single node)
            initialAbsolutePositions.current.forEach((initAbsPos, id) => {
                const node = nodeMap.get(id);
                if (!node) return;

                const dims = initialDimensions.current.get(id);
                const w = dims?.w ?? node.measured?.width ?? node.width ?? 150;
                const h = dims?.h ?? node.measured?.height ?? node.height ?? 50;

                const initialCenterX = initAbsPos.x;
                const initialCenterY = initAbsPos.y;

                if (isSingleScale) {
                    // Visual Anchoring (Top-Left fixed, expand right/bottom)
                    const newW = w * sx;
                    const newH = h * sy;

                    // Shift center by half the size difference to keep top-left pinned
                    const newCenterX = initialCenterX + (newW - w) / 2;
                    const newCenterY = initialCenterY + (newH - h) / 2;

                    newDimensions.set(id, { w: newW, h: newH });
                    newAbsolutePositions.set(id, { x: newCenterX, y: newCenterY });
                } else {
                    // Multi-node spread scaling around centroid
                    const dx = initialCenterX - center.x;
                    const dy = initialCenterY - center.y;

                    const newCenterX = center.x + dx * sx;
                    const newCenterY = center.y + dy * sy;

                    newAbsolutePositions.set(id, {
                        x: newCenterX,
                        y: newCenterY
                    });
                }
            });

            const affectedParentIds = new Set<string>();

            // 2. Apply updates, converting back to relative if needed
            const updatedNodes = nodes.map(node => {
                const newAbsPos = newAbsolutePositions.get(node.id);
                if (!newAbsPos) return node;

                let finalPos = newAbsPos;

                if (node.parentId) {
                    // Check if parent is also being scaled (and thus has a new absolute pos)
                    // or if we should use its current absolute pos
                    // Calculate parent absolute Top-Left
                    let parentAbs: XYPosition;
                    let parentW: number, parentH: number;

                    if (newAbsolutePositions.has(node.parentId)) {
                        parentAbs = newAbsolutePositions.get(node.parentId)!;
                        const newDims = newDimensions.get(node.parentId);
                        const parentNode = nodeMap.get(node.parentId);
                        parentW = newDims?.w ?? Number(parentNode?.measured?.width ?? parentNode?.width ?? parentNode?.data?.width ?? 0);
                        parentH = newDims?.h ?? Number(parentNode?.measured?.height ?? parentNode?.height ?? parentNode?.data?.height ?? 0);
                    } else {
                        parentAbs = getAbsolutePosition(node.parentId, nodeMap);
                        const parentNode = nodeMap.get(node.parentId);
                        parentW = Number(parentNode?.measured?.width ?? parentNode?.width ?? parentNode?.data?.width ?? 0);
                        parentH = Number(parentNode?.measured?.height ?? parentNode?.height ?? parentNode?.data?.height ?? 0);
                    }

                    const parentTL_X = parentAbs.x - parentW / 2;
                    const parentTL_Y = parentAbs.y - parentH / 2;

                    finalPos = {
                        x: newAbsPos.x - parentTL_X,
                        y: newAbsPos.y - parentTL_Y
                    };
                    affectedParentIds.add(node.parentId);
                }

                const newDims = newDimensions.get(node.id);
                const newNode = {
                    ...node,
                    position: finalPos,
                    ...(newDims ? {
                        width: Math.round(newDims.w),
                        height: Math.round(newDims.h),
                        style: {
                            ...node.style,
                            width: Math.round(newDims.w),
                            height: Math.round(newDims.h)
                        },
                        data: {
                            ...node.data,
                            width: Math.round(newDims.w),
                            height: Math.round(newDims.h)
                        }
                    } : {})
                };

                // Update map for subsequent frame resize logic
                nodeMap.set(node.id, newNode);
                return newNode;
            });

            // 3. Real-time Frame Auto-Resize
            updateParentFrames(nodeMap, affectedParentIds);

            // Return updated values from map to ensure frames are included
            return Array.from(nodeMap.values());
        });
    }, [setNodes, axisLock, getAbsolutePosition, updateParentFrames]);

    const applyRotate = useCallback((angleRad: number) => {
        const center = centerRef.current;
        if (!center) return;

        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        setNodes((nodes) => {
            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            const newAbsolutePositions = new Map<string, XYPosition>();

            // 1. Calculate new ABSOLUTE positions
            initialAbsolutePositions.current.forEach((initAbsPos, id) => {
                const node = nodeMap.get(id);
                if (!node) return;

                const dims = initialDimensions.current.get(id);
                const w = dims?.w ?? node.measured?.width ?? node.width ?? 150;
                const h = dims?.h ?? node.measured?.height ?? node.height ?? 50;

                const initialCenterX = initAbsPos.x;
                const initialCenterY = initAbsPos.y;

                const dx = initialCenterX - center.x;
                const dy = initialCenterY - center.y;

                const newCenterX = center.x + (dx * cos - dy * sin);
                const newCenterY = center.y + (dx * sin + dy * cos);

                newAbsolutePositions.set(id, {
                    x: newCenterX,
                    y: newCenterY
                });
            });

            const affectedParentIds = new Set<string>();

            // 2. Apply updates, converting back to relative
            const updatedNodes = nodes.map(node => {
                const newAbsPos = newAbsolutePositions.get(node.id);
                if (!newAbsPos) return node;

                let finalPos = newAbsPos;

                if (node.parentId) {
                    let parentAbs: XYPosition;
                    let parentW: number, parentH: number;

                    if (newAbsolutePositions.has(node.parentId)) {
                        parentAbs = newAbsolutePositions.get(node.parentId)!;
                        const parentNode = nodeMap.get(node.parentId);
                        parentW = Number(parentNode?.measured?.width ?? parentNode?.width ?? parentNode?.data?.width ?? 0);
                        parentH = Number(parentNode?.measured?.height ?? parentNode?.height ?? parentNode?.data?.height ?? 0);
                    } else {
                        parentAbs = getAbsolutePosition(node.parentId, nodeMap);
                        const parentNode = nodeMap.get(node.parentId);
                        parentW = Number(parentNode?.measured?.width ?? parentNode?.width ?? parentNode?.data?.width ?? 0);
                        parentH = Number(parentNode?.measured?.height ?? parentNode?.height ?? parentNode?.data?.height ?? 0);
                    }

                    const parentTL_X = parentAbs.x - parentW / 2;
                    const parentTL_Y = parentAbs.y - parentH / 2;

                    finalPos = {
                        x: newAbsPos.x - parentTL_X,
                        y: newAbsPos.y - parentTL_Y
                    };
                    affectedParentIds.add(node.parentId);
                }

                const newNode = {
                    ...node,
                    position: finalPos
                };
                nodeMap.set(node.id, newNode);
                return newNode;
            });

            // 3. Real-time Frame Auto-Resize
            updateParentFrames(nodeMap, affectedParentIds);

            return Array.from(nodeMap.values());
        });
    }, [setNodes, getAbsolutePosition, updateParentFrames]);


    // --- Interaction Core ---
    const updateInteraction = useCallback((mousePos: XYPosition, ctrlKey: boolean = false) => {
        if (mode === 'GRABBING' && startFlowPos.current) {
            if (transformBuffer !== '') return;

            const currentFlowPos = project(mousePos);
            let dx = currentFlowPos.x - startFlowPos.current.x;
            let dy = currentFlowPos.y - startFlowPos.current.y;

            if (axisLock === 'X') dy = 0;
            if (axisLock === 'Y') dx = 0;

            if (ctrlKey) {
                const GRID_SIZE = 20;
                dx = Math.round(dx / GRID_SIZE) * GRID_SIZE;
                dy = Math.round(dy / GRID_SIZE) * GRID_SIZE;
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
            const center = centerRef.current;

            const startDist = Math.hypot(flowStartMouse.x - center.x, flowStartMouse.y - center.y);
            const currentDist = Math.hypot(currentFlowPos.x - center.x, currentFlowPos.y - center.y);

            const scale = startDist > 0 ? currentDist / startDist : 1;
            setTransformValue(scale.toFixed(2));
            applyScale(scale);

        } else if (mode === 'ROTATING' && startMousePos.current && centerRef.current) {
            if (transformBuffer !== '') return;

            const currentFlowPos = project(mousePos);
            const center = centerRef.current;
            const currentAngle = Math.atan2(currentFlowPos.y - center.y, currentFlowPos.x - center.x);

            let delta = currentAngle - lastAngleRef.current;
            if (delta > Math.PI) delta -= 2 * Math.PI;
            if (delta < -Math.PI) delta += 2 * Math.PI;

            accumulatedRotation.current += delta;
            lastAngleRef.current = currentAngle;

            const deg = (accumulatedRotation.current * 180 / Math.PI);
            setTransformValue(deg.toFixed(1) + '°');
            applyRotate(accumulatedRotation.current);
        }
    }, [mode, project, axisLock, transformBuffer, applyMove, applyScale, applyRotate]);

    // --- Autopan Loop ---
    const autopan = useCallback(function autopanLoop() {
        if (!['GRABBING', 'SCALING', 'ROTATING'].includes(mode) || !mousePosRef.current) {
            rafRef.current = null;
            return;
        }

        const { x, y } = mousePosRef.current;
        const pad = 100;
        const w = window.innerWidth;
        const h = window.innerHeight;

        let panX = 0;
        let panY = 0;

        const getSpeed = (dist: number) => {
            const normalized = Math.max(0, dist / pad);
            return Math.pow(normalized, 1.5) * 20;
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
    const startGrab = useCallback((mousePos: XYPosition, isAltHeld: boolean = false, overrideNodes?: Node[]) => {
        modifiedFrameIds.current.clear();
        initialParentPositions.current.clear();
        initialFrameStates.current.clear();
        initialFrameChildrenStates.current.clear();
        const nodes = getNodes();
        let selected: Node[] = [];

        if (overrideNodes) {
            selected = overrideNodes.filter(n => n.type !== 'frame');
        } else {
            selected = nodes.filter(n => n.selected && n.type !== 'frame');
        }

        if (selected.length === 0) return;

        if (isAltHeld && !overrideNodes) {
            detachSelected();
        }

        initialPositions.current = new Map(selected.map((n) => {
            // Capture parent position if exists
            if (n.parentId) {
                const parent = nodes.find(p => p.id === n.parentId);
                if (parent) {
                    initialParentPositions.current.set(n.parentId, { ...parent.position });
                }
            }
            return [n.id, { ...n.position }];
        }));
        initialAbsolutePositions.current.clear();
        startMousePos.current = mousePos;
        startFlowPos.current = project(mousePos);
        setAxisLock(null);
        setMode('GRABBING');
    }, [getNodes, detachSelected, project]);

    const startScale = useCallback((mousePos: XYPosition) => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected && n.type !== 'frame');
        if (selected.length === 0) return;

        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Store RELATIVE positions for restore/undo
        initialPositions.current = new Map(selected.map((n) => [n.id, { ...n.position }]));

        // Store ABSOLUTE positions for calculation
        initialAbsolutePositions.current = new Map(selected.map((n) => [
            n.id,
            getAbsolutePosition(n.id, nodeMap)
        ]));

        // Store Dimensions for stability
        initialDimensions.current = new Map(selected.map((n) => [
            n.id,
            {
                w: n.measured?.width ?? n.width ?? 150,
                h: n.measured?.height ?? n.height ?? 50
            }
        ]));

        centerRef.current = getCentroid(selected, nodeMap);
        startMousePos.current = mousePos;
        startFlowPos.current = project(mousePos);
        setMode('SCALING');
    }, [getNodes, project, getAbsolutePosition]);

    const startRotate = useCallback((mousePos: XYPosition) => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected && n.type !== 'frame');
        if (selected.length === 0) return;

        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Store RELATIVE positions for restore/undo
        initialPositions.current = new Map(selected.map((n) => [n.id, { ...n.position }]));

        // Store ABSOLUTE positions for calculation
        initialAbsolutePositions.current = new Map(selected.map((n) => [
            n.id,
            getAbsolutePosition(n.id, nodeMap)
        ]));

        // Store Dimensions for stability
        initialDimensions.current = new Map(selected.map((n) => [
            n.id,
            {
                w: n.measured?.width ?? n.width ?? 150,
                h: n.measured?.height ?? n.height ?? 50
            }
        ]));

        centerRef.current = getCentroid(selected, nodeMap);

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
        setMode('ROTATING');
    }, [getNodes, project, getAbsolutePosition]);

    const confirmGrab = useCallback(() => {
        const nodes = getNodes();
        const txs: Transaction[] = [];
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Helper: get node dimensions safely
        const getSize = (n: Node) => ({
            w: n.measured?.width ?? n.width ?? (n.data?.width as number) ?? 150,
            h: n.measured?.height ?? n.height ?? (n.data?.height as number) ?? 50,
        });

        // 1. Identify moved or resized nodes
        const movedNodeIds = new Set<string>();
        initialPositions.current.forEach((initPos, id) => {
            const node = nodes.find(n => n.id === id);
            if (node) {
                const initDim = initialDimensions.current.get(id);
                const { w, h } = getSize(node);
                const dw = initDim ? Math.abs(w - initDim.w) : 0;
                const dh = initDim ? Math.abs(h - initDim.h) : 0;
                if (Math.abs(node.position.x - initPos.x) > 0.5 || Math.abs(node.position.y - initPos.y) > 0.5 || dw > 0.5 || dh > 0.5) {
                    movedNodeIds.add(id);
                }
            }
        });

        if (movedNodeIds.size === 0) {
            isResolvingRef.current = true;
            setTimeout(() => { isResolvingRef.current = false; }, 100);

            setMode('IDLE');
            initialPositions.current.clear();
            initialDimensions.current.clear();
            initialFrameStates.current.clear();
            startMousePos.current = null;
            return;
        }

        // 2. Identify and Process Parents
        const frames = nodes.filter(n => n.type === 'frame');
        const affectedParents = new Set<string>();
        const plannedParentId = new Map<string, string | undefined>();
        const plannedDimensions = new Map<string, { w: number, h: number }>();

        // Find parent for each moved node (absolute detect)
        movedNodeIds.forEach(id => {
            const node = nodes.find(n => n.id === id);
            if (!node || node.type === 'frame') return;

            const oldParentId = node.parentId;
            const absPos = getAbsolutePosition(id, nodeMap);
            const { w, h } = getSize(node);

            // Detect new parent
            let targetFrame: Node | undefined;
            let targetArea = Infinity;
            frames.forEach(f => {
                if (f.id === id) return;
                const { w: fw, h: fh } = getSize(f);
                if (absPos.x >= f.position.x - fw / 2 && absPos.x <= f.position.x + fw / 2 &&
                    absPos.y >= f.position.y - fh / 2 && absPos.y <= f.position.y + fh / 2) {
                    if (fw * fh < targetArea) { targetArea = fw * fh; targetFrame = f; }
                }
            });

            // Sticky logic
            let newParentId = targetFrame?.id;
            if (oldParentId && !newParentId) {
                const op = nodes.find(p => p.id === oldParentId);
                if (op) {
                    const { w: ow, h: oh } = getSize(op);
                    const pad = 100;
                    if (absPos.x >= op.position.x - ow / 2 - pad && absPos.x <= op.position.x + ow / 2 + pad &&
                        absPos.y >= op.position.y - oh / 2 - pad && absPos.y <= op.position.y + oh / 2 + pad) {
                        newParentId = oldParentId;
                    }
                }
            }

            if (newParentId !== oldParentId) {
                plannedParentId.set(id, newParentId);
                if (oldParentId) affectedParents.add(oldParentId);
            }
            if (newParentId) affectedParents.add(newParentId);

            // Record dimensions
            const initDim = initialDimensions.current.get(id);
            if (initDim && (Math.abs(w - initDim.w) > 0.5 || Math.abs(h - initDim.h) > 0.5)) {
                plannedDimensions.set(id, { w: Math.round(w), h: Math.round(h) });
            }
        });

        // 3. Reconcile Frame Bounds and Child Coordinates
        affectedParents.forEach(parentId => {
            const parent = nodes.find(n => n.id === parentId);
            if (!parent) return;

            // Find all children (after new parent assignments)
            const children = nodes.filter(n => {
                if (n.id === parentId) return false;
                const actualParentId = plannedParentId.has(n.id) ? plannedParentId.get(n.id) : n.parentId;
                return actualParentId === parentId;
            });

            if (children.length === 0) {
                txs.push({ type: 'REMOVE_NODE', payload: parentId });
                return;
            }

            // Calculate new bounds in absolute space
            const oldWidth = Number(parent.measured?.width ?? parent.width ?? 150);
            const oldHeight = Number(parent.measured?.height ?? parent.height ?? 50);
            const oldTL_X = parent.position.x - oldWidth / 2, oldTL_Y = parent.position.y - oldHeight / 2;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            children.forEach(c => {
                const { w, h } = getSize(c);
                // Current absolute position of the child
                let cAbs;
                if (movedNodeIds.has(c.id)) {
                    // Get absolute pos from initial parent TL + current relative pos
                    const parentOfInit = nodes.find(p => p.id === c.parentId);
                    if (parentOfInit) {
                        const { w: pw, h: ph } = getSize(parentOfInit);
                        cAbs = { x: parentOfInit.position.x - pw / 2 + c.position.x, y: parentOfInit.position.y - ph / 2 + c.position.y };
                    } else { cAbs = c.position; }
                } else {
                    cAbs = getAbsolutePosition(c.id, nodeMap);
                }
                minX = Math.min(minX, cAbs.x - w / 2); minY = Math.min(minY, cAbs.y - h / 2);
                maxX = Math.max(maxX, cAbs.x + w / 2); maxY = Math.max(maxY, cAbs.y + h / 2);
            });

            const PAD = 40;
            const newAbsTL_X = minX - PAD, newAbsTL_Y = minY - PAD;
            const newWidth = (maxX + PAD) - newAbsTL_X, newHeight = (maxY + PAD) - newAbsTL_Y;
            // const shiftX = newAbsTL_X - oldTL_X, shiftY = newAbsTL_Y - oldTL_Y; // Not used

            txs.push({ type: 'MOVE_NODE', payload: { id: parentId, position: { x: newAbsTL_X + newWidth / 2, y: newAbsTL_Y + newHeight / 2 }, oldPosition: parent.position } });
            txs.push({ type: 'UPDATE_NODE_DATA', payload: { id: parentId, data: { width: Math.round(newWidth), height: Math.round(newHeight) } } });

            // Update all children positions to be relative to new TL
            children.forEach(c => {
                // const { w, h } = getSize(c); // Not used
                let cAbs;
                if (movedNodeIds.has(c.id)) {
                    const parentOfInit = nodes.find(p => p.id === c.parentId);
                    if (parentOfInit) {
                        const { w: pw, h: ph } = getSize(parentOfInit);
                        cAbs = { x: parentOfInit.position.x - pw / 2 + c.position.x, y: parentOfInit.position.y - ph / 2 + c.position.y };
                    } else { cAbs = c.position; }
                } else {
                    cAbs = getAbsolutePosition(c.id, nodeMap);
                }
                const newRelativePos = { x: cAbs.x - newAbsTL_X, y: cAbs.y - newAbsTL_Y };
                const initPos = initialPositions.current.get(c.id) || c.position;
                txs.push({ type: 'MOVE_NODE', payload: { id: c.id, position: newRelativePos, oldPosition: initPos } });

                // Commit parentId and dimension if changed
                const data: any = {};
                if (plannedParentId.has(c.id)) data.parentId = plannedParentId.get(c.id);
                if (plannedDimensions.has(c.id)) {
                    const dim = plannedDimensions.get(c.id)!;
                    data.width = dim.w; data.height = dim.h;
                }
                if (Object.keys(data).length > 0) {
                    txs.push({ type: 'UPDATE_NODE_DATA', payload: { id: c.id, data } });
                }
            });
        });

        // 4. Final non-framed moved nodes
        movedNodeIds.forEach(id => {
            const node = nodes.find(n => n.id === id);
            if (!node || node.type === 'frame') return;
            const actualParentId = plannedParentId.has(id) ? plannedParentId.get(id) : node.parentId;

            if (!actualParentId) {
                let absPos = node.position;
                const oldParent = nodes.find(p => p.id === node.parentId);
                if (oldParent) {
                    const { w, h } = getSize(oldParent);
                    absPos = { x: oldParent.position.x - w / 2 + node.position.x, y: oldParent.position.y - h / 2 + node.position.y };
                }
                txs.push({ type: 'MOVE_NODE', payload: { id, position: absPos, oldPosition: initialPositions.current.get(id)! } });

                const data: any = { parentId: null };
                if (plannedDimensions.has(id)) {
                    const dim = plannedDimensions.get(id)!;
                    data.width = dim.w; data.height = dim.h;
                }
                txs.push({ type: 'UPDATE_NODE_DATA', payload: { id, data } });
            }
        });

        if (txs.length > 0) {
            Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });
        }

        isResolvingRef.current = true;
        setTimeout(() => { isResolvingRef.current = false; }, 100);

        setMode('IDLE');
        initialPositions.current.clear();
        initialDimensions.current.clear();
        initialFrameStates.current.clear();
        startMousePos.current = null;
        startFlowPos.current = null;
        centerRef.current = null;
        setAxisLock(null);
        setTransformBuffer('');
        setTransformValue('');
    }, [getNodes, getAbsolutePosition, setNodes]);

    const cancelGrab = useCallback(() => {
        const positionsToRestore = new Map(initialPositions.current);
        const framesToRestore = new Map(initialFrameStates.current);

        const idsToSelect = new Set<string>([...positionsToRestore.keys(), ...framesToRestore.keys()]);

        setNodes(nodes => nodes.map(n => {
            // Restore Frames
            if (framesToRestore.has(n.id)) {
                return { ...framesToRestore.get(n.id)! };
            }
            // Restore Nodes
            const init = positionsToRestore.get(n.id);
            if (init) {
                return { ...n, position: init };
            }
            return n;
        }));

        isResolvingRef.current = true;
        setTimeout(() => { isResolvingRef.current = false; }, 100);

        setMode('IDLE');
        initialPositions.current.clear();
        initialDimensions.current.clear();
        initialFrameStates.current.clear();
        startMousePos.current = null;
        startFlowPos.current = null;
        centerRef.current = null;
        setAxisLock(null);
        setTransformBuffer('');
        setTransformValue('');
    }, [setNodes]);


    // --- Event Handlers ---
    const handleMouseDown = useCallback((e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.react-flow__handle') || target.closest('.react-flow__edge')) return;
        if (target.closest('.nodrag')) return; // Ignore custom drag if clicking on a protected area

        if (e.ctrlKey && e.button === 2) {
            setMode('CUTTING');
            startCut({ x: e.clientX, y: e.clientY });
            return;
        }

        if (e.button === 0) {
            const nodeElement = target.closest('.react-flow__node');
            if (nodeElement) {
                const nodeId = nodeElement.getAttribute('data-id');
                if (nodeId) {
                    const nodes = getNodes();
                    const clickedNode = nodes.find(n => n.id === nodeId);
                    if (clickedNode) {
                        if (!e.shiftKey && !e.ctrlKey) {
                            if (!clickedNode.selected) selectNode(nodeId, true);
                        } else {
                            selectNode(nodeId, false);
                        }
                        pendingGrabStart.current = { x: e.clientX, y: e.clientY, altKey: e.altKey };
                    }
                }
            }
        }
    }, [startCut, getNodes, selectNode]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const currentMousePos = { x: e.clientX, y: e.clientY };
        mousePosRef.current = currentMousePos;

        if (mode === 'IDLE' && pendingGrabStart.current) {
            const dist = Math.hypot(
                currentMousePos.x - pendingGrabStart.current.x,
                currentMousePos.y - pendingGrabStart.current.y
            );
            if (dist > 5) {
                startGrab(pendingGrabStart.current, pendingGrabStart.current.altKey);
                pendingGrabStart.current = null;
                return;
            }
        }

        if (mode === 'CUTTING') {
            updateCut(currentMousePos);
        } else {
            updateInteraction(currentMousePos, e.ctrlKey);
        }
    }, [mode, updateCut, updateInteraction, startGrab]);

    // --- Modal Action Logic ---
    const handleModalMouseUp = useCallback((e: MouseEvent) => {
        const isTransformMode = ['GRABBING', 'SCALING', 'ROTATING'].includes(mode);
        if (!isTransformMode) return;

        if (e.button === 0) {
            confirmGrab();
        } else if (e.button === 2) {
            cancelGrab();
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
            handleModalMouseUp(e);
        }
    }, [mode, endCut, handleModalMouseUp, selectNode]);

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
        transformBuffer,
        transformValue,
        startGrab,
        startScale,
        startRotate,
        confirmGrab,
        cancelGrab,
        duplicateSelected,
        bundleSelected,
        copyToClipboard,
        pasteFromClipboard,
        deleteSelected,
        resetSelected,
        swapConnections,
        detachSelected,
        clearSelection,
        selectNode,
        setAxisLock,
        handleTypeNum,
        handleMouseMove,
        handleMouseDown,
        handleMouseUp,
        isResolvingTransform: () => isResolvingRef.current
    };
}
