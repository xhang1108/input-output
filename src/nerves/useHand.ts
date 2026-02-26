import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow, Node, XYPosition } from '@xyflow/react';
import { useCanvasProjection } from '../hooks/useCanvasProjection';
import { Brain } from '../engine/Brain';
import { Transaction } from '../engine/types';
import { useClipboard } from './useClipboard';
import { useSelection } from './useSelection';
import { useKnife } from './useKnife';
import { useModalAction } from '../hooks/useModalAction';

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
        deleteSelected, resetSelected, groupSelected,
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

    // Autopan
    const mousePosRef = useRef<XYPosition | null>(null);
    const rafRef = useRef<number | null>(null);
    const modifiedFrameIds = useRef<Set<string>>(new Set());
    const initialParentPositions = useRef<Map<string, XYPosition>>(new Map());

    // --- Transform Helpers ---
    const getAbsolutePosition = useCallback(function getAbs(nodeId: string, nodeMap: Map<string, Node>): XYPosition {
        const node = nodeMap.get(nodeId);
        if (!node) return { x: 0, y: 0 };
        if (!node.parentId) return node.position;

        const parentPos = getAbs(node.parentId, nodeMap);
        return {
            x: parentPos.x + node.position.x,
            y: parentPos.y + node.position.y
        };
    }, []);

    const updateParentFrames = useCallback((nodeMap: Map<string, Node>, affectedParentIds: Set<string>) => {
        affectedParentIds.forEach(parentId => {
            const parent = nodeMap.get(parentId);
            if (!parent || parent.type !== 'frame') return;

            // Find all children (including currently moved ones)
            const children = Array.from(nodeMap.values()).filter(n => n.parentId === parentId);

            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;

            children.forEach(child => {
                const w = child.measured?.width ?? child.width ?? 150;
                const h = child.measured?.height ?? child.height ?? 50;
                minX = Math.min(minX, child.position.x);
                minY = Math.min(minY, child.position.y);
                maxX = Math.max(maxX, child.position.x + w);
                maxY = Math.max(maxY, child.position.y + h);
            });

            if (minX === Infinity) return;

            const PAD = 40;
            const TOP_PAD = 40;

            const targetLeft = minX - PAD;
            const targetTop = minY - TOP_PAD;
            const newWidth = (maxX + PAD) - targetLeft;
            const newHeight = (maxY + PAD) - targetTop;

            // Shift delta (relative to current frame pos)
            const shiftX = targetLeft;
            const shiftY = targetTop;

            // Check if update is needed (Visual or Structural)
            // Use a tiny threshold to prevent floating point noise but allow smooth updates
            const needsShift = Math.abs(shiftX) > 0.1 || Math.abs(shiftY) > 0.1;
            const needsResize = Math.abs((parent.width ?? 0) - newWidth) > 0.1 || Math.abs((parent.height ?? 0) - newHeight) > 0.1;

            if (needsShift || needsResize) {
                // Snapshot frame state BEFORE first modification
                if (!initialFrameStates.current.has(parentId)) {
                    initialFrameStates.current.set(parentId, { ...parent });
                }

                modifiedFrameIds.current.add(parentId);

                // Update Parent Frame
                const newParent = {
                    ...parent,
                    position: {
                        x: parent.position.x + shiftX,
                        y: parent.position.y + shiftY
                    },
                    width: Math.round(newWidth),
                    height: Math.round(newHeight),
                    style: { ...parent.style, width: Math.round(newWidth), height: Math.round(newHeight) }
                };
                nodeMap.set(parentId, newParent);

                // Offset Children if frame moved
                if (needsShift) {
                    children.forEach(child => {
                        const newChild = {
                            ...child,
                            position: {
                                x: child.position.x - shiftX,
                                y: child.position.y - shiftY
                            }
                        };
                        nodeMap.set(child.id, newChild);
                    });
                }
            }
        });
    }, []);

    const applyMove = useCallback((dx: number, dy: number) => {
        setNodes((currentNodes) => {
            const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
            const affectedParentIds = new Set<string>();

            // 1. Update Moved Nodes
            initialPositions.current.forEach((initPos, id) => {
                const node = nodeMap.get(id);
                if (node) {
                    let newX = initPos.x + dx;
                    let newY = initPos.y + dy;

                    // Compensation for Parent Movement
                    if (node.parentId) {
                        const initParentPos = initialParentPositions.current.get(node.parentId);
                        const currentParent = nodeMap.get(node.parentId);

                        // If parent has moved from initial, we must adjust the relative child pos
                        if (initParentPos && currentParent) {
                            // Target Absolute = (InitParent + InitChild) + d
                            // New Relative = Target Absolute - CurrentParent
                            const absTargetX = initParentPos.x + initPos.x + dx;
                            const absTargetY = initParentPos.y + initPos.y + dy;

                            newX = absTargetX - currentParent.position.x;
                            newY = absTargetY - currentParent.position.y;
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
            minX = Math.min(minX, absPos.x);
            maxX = Math.max(maxX, absPos.x + w);
            minY = Math.min(minY, absPos.y);
            maxY = Math.max(maxY, absPos.y + h);
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

            // 1. Calculate new ABSOLUTE positions for all selected nodes
            initialAbsolutePositions.current.forEach((initAbsPos, id) => {
                const node = nodeMap.get(id);
                if (!node) return;

                const dims = initialDimensions.current.get(id);
                const w = dims?.w ?? node.measured?.width ?? node.width ?? 150;
                const h = dims?.h ?? node.measured?.height ?? node.height ?? 50;

                const initialCenterX = initAbsPos.x + w / 2;
                const initialCenterY = initAbsPos.y + h / 2;

                const dx = initialCenterX - center.x;
                const dy = initialCenterY - center.y;

                const newCenterX = center.x + dx * sx;
                const newCenterY = center.y + dy * sy;

                newAbsolutePositions.set(id, {
                    x: newCenterX - w / 2,
                    y: newCenterY - h / 2
                });
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
                    if (newAbsolutePositions.has(node.parentId)) {
                        const parentNewAbs = newAbsolutePositions.get(node.parentId)!;
                        finalPos = {
                            x: newAbsPos.x - parentNewAbs.x,
                            y: newAbsPos.y - parentNewAbs.y
                        };
                    } else {
                        // Parent static
                        const parentAbs = getAbsolutePosition(node.parentId, nodeMap);
                        finalPos = {
                            x: newAbsPos.x - parentAbs.x,
                            y: newAbsPos.y - parentAbs.y
                        };
                    }
                    affectedParentIds.add(node.parentId);
                }

                const newNode = {
                    ...node,
                    position: finalPos
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

                const initialCenterX = initAbsPos.x + w / 2;
                const initialCenterY = initAbsPos.y + h / 2;

                const dx = initialCenterX - center.x;
                const dy = initialCenterY - center.y;

                const newCenterX = center.x + (dx * cos - dy * sin);
                const newCenterY = center.y + (dx * sin + dy * cos);

                newAbsolutePositions.set(id, {
                    x: newCenterX - w / 2,
                    y: newCenterY - h / 2
                });
            });

            const affectedParentIds = new Set<string>();

            // 2. Apply updates, converting back to relative
            const updatedNodes = nodes.map(node => {
                const newAbsPos = newAbsolutePositions.get(node.id);
                if (!newAbsPos) return node;

                let finalPos = newAbsPos;

                if (node.parentId) {
                    if (newAbsolutePositions.has(node.parentId)) {
                        const parentNewAbs = newAbsolutePositions.get(node.parentId)!;
                        finalPos = {
                            x: newAbsPos.x - parentNewAbs.x,
                            y: newAbsPos.y - parentNewAbs.y
                        };
                    } else {
                        const parentAbs = getAbsolutePosition(node.parentId, nodeMap);
                        finalPos = {
                            x: newAbsPos.x - parentAbs.x,
                            y: newAbsPos.y - parentAbs.y
                        };
                    }
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
        const nodes = getNodes();
        let selected: Node[] = [];

        if (overrideNodes) {
            selected = overrideNodes;
        } else {
            selected = nodes.filter(n => n.selected);
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
        const selected = nodes.filter(n => n.selected);
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
        const selected = nodes.filter(n => n.selected);
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

        // Helper: get node dimensions safely
        const getSize = (n: Node) => ({
            w: n.measured?.width ?? n.width ?? (n.data?.width as number) ?? 150,
            h: n.measured?.height ?? n.height ?? (n.data?.height as number) ?? 50,
        });

        // 1. Identify moved nodes
        const movedNodes: Node[] = [];
        initialPositions.current.forEach((initPos, id) => {
            const node = nodes.find(n => n.id === id);
            if (node) {
                const dx = node.position.x - initPos.x;
                const dy = node.position.y - initPos.y;
                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                    movedNodes.push(node);
                }
            }
        });

        if (movedNodes.length === 0) {
            setMode('IDLE');
            initialPositions.current.clear();
            return;
        }

        // 2. Get all frames (for intersection checks)
        const frames = nodes.filter(n => n.type === 'frame');

        movedNodes.forEach(node => {
            // Frames don't get reparented
            if (node.type === 'frame') {
                const initPos = initialPositions.current.get(node.id)!;
                txs.push({
                    type: 'MOVE_NODE',
                    payload: { id: node.id, position: { ...node.position }, oldPosition: { ...initPos } }
                });
                return;
            }

            // 3. Calculate absolute center of the node
            const { w, h } = getSize(node);
            let absCenterX = node.position.x + w / 2;
            let absCenterY = node.position.y + h / 2;

            // If currently parented, convert to absolute coords
            if (node.parentId) {
                const parent = nodes.find(n => n.id === node.parentId);
                if (parent) {
                    absCenterX += parent.position.x;
                    absCenterY += parent.position.y;
                }
            }

            // 4. Find the smallest containing frame (avoids wrong match with nested frames)
            let targetFrame: Node | undefined;
            let targetArea = Infinity;

            for (const frame of frames) {
                if (frame.id === node.id) continue;
                const { w: fw, h: fh } = getSize(frame);
                const fX = frame.position.x;
                const fY = frame.position.y;

                if (absCenterX >= fX && absCenterX <= fX + fw &&
                    absCenterY >= fY && absCenterY <= fY + fh) {
                    const area = fw * fh;
                    if (area < targetArea) {
                        targetArea = area;
                        targetFrame = frame;
                    }
                }
            }

            // 5. Determine parent change
            const oldParentId = node.parentId;
            let newParentId = targetFrame?.id;

            // Auto-Resize Feature:
            // If dragging from a frame to void (no target frame), keep original parent
            // so the frame can auto-resize instead of detaching the node.
            if (oldParentId && !newParentId) {
                newParentId = oldParentId;
            }

            if (newParentId !== oldParentId) {
                // Parent changed — coordinate space transform needed
                const newPos = { ...node.position };

                // Convert to absolute (if was child)
                if (oldParentId) {
                    const oldParent = nodes.find(n => n.id === oldParentId);
                    if (oldParent) {
                        newPos.x += oldParent.position.x;
                        newPos.y += oldParent.position.y;

                        // --- FIX: Resize OLD Parent Frame (Hub abandoned) ---
                        // The frame might have expanded during drag (autopan/grow). 
                        // Now that the child is leaving, we must shrink-wrap the frame to remaining children.
                        const remainingSiblings = nodes.filter(n => n.parentId === oldParentId && n.id !== node.id);

                        if (remainingSiblings.length === 0) {
                            // Empty frame -> Remove
                            txs.push({ type: 'REMOVE_NODE', payload: oldParentId });
                        } else {
                            // Resize frame to fit remaining sibilings
                            let minX = Infinity, minY = Infinity;
                            let maxX = -Infinity, maxY = -Infinity;

                            remainingSiblings.forEach(child => {
                                const w = child.measured?.width ?? child.width ?? 150;
                                const h = child.measured?.height ?? child.height ?? 50;
                                minX = Math.min(minX, child.position.x);
                                minY = Math.min(minY, child.position.y);
                                maxX = Math.max(maxX, child.position.x + w);
                                maxY = Math.max(maxY, child.position.y + h);
                            });

                            const PAD = 40;
                            const TOP_PAD = 70;
                            const targetLeft = minX - PAD;
                            const targetTop = minY - TOP_PAD;
                            const newWidth = (maxX + PAD) - targetLeft;
                            const newHeight = (maxY + PAD) - targetTop;

                            const shiftX = targetLeft;
                            const shiftY = targetTop;

                            // 1. Update Old Parent
                            txs.push({
                                type: 'MOVE_NODE',
                                payload: {
                                    id: oldParentId,
                                    position: {
                                        x: oldParent.position.x + shiftX,
                                        y: oldParent.position.y + shiftY
                                    },
                                    oldPosition: { ...oldParent.position }
                                }
                            });
                            txs.push({
                                type: 'UPDATE_NODE_DATA',
                                payload: {
                                    id: oldParentId,
                                    data: {
                                        width: Math.round(newWidth),
                                        height: Math.round(newHeight)
                                    }
                                }
                            });

                            // 2. Shift Remaining Siblings (Visual Fix)
                            remainingSiblings.forEach(child => {
                                txs.push({
                                    type: 'MOVE_NODE',
                                    payload: {
                                        id: child.id,
                                        position: {
                                            x: child.position.x - shiftX,
                                            y: child.position.y - shiftY
                                        },
                                        oldPosition: { ...child.position }
                                    }
                                });
                            });
                        }
                    }
                }

                // Convert to relative (if becoming child)
                if (newParentId && targetFrame) {
                    newPos.x -= targetFrame.position.x;
                    newPos.y -= targetFrame.position.y;
                }

                // 5a. Update structure
                txs.push({
                    type: 'UPDATE_NODE_DATA',
                    payload: {
                        id: node.id,
                        data: {
                            parentId: newParentId
                        }
                    }
                });

                // 5b. Update position
                txs.push({
                    type: 'MOVE_NODE',
                    payload: {
                        id: node.id,
                        position: newPos,
                        oldPosition: initialPositions.current.get(node.id)!
                    }
                });
            } else {
                // Standard move (no parent change)
                const finalPos = { ...node.position };

                // Auto-Resize Parent Frame
                if (node.parentId) {
                    const parent = nodes.find(n => n.id === node.parentId);
                    if (parent) {
                        const siblings = nodes.filter(n => n.parentId === node.parentId && n.id !== node.id);

                        // Calculate bounds including the dragged node
                        let minX = finalPos.x;
                        let minY = finalPos.y;
                        let maxX = finalPos.x + (node.measured?.width ?? node.width ?? 150);
                        let maxY = finalPos.y + (node.measured?.height ?? node.height ?? 50);

                        siblings.forEach(child => {
                            const w = child.measured?.width ?? child.width ?? 150;
                            const h = child.measured?.height ?? child.height ?? 50;
                            minX = Math.min(minX, child.position.x);
                            minY = Math.min(minY, child.position.y);
                            maxX = Math.max(maxX, child.position.x + w);
                            maxY = Math.max(maxY, child.position.y + h);
                        });

                        const PAD = 40;
                        const TOP_PAD = 40;

                        // Target child region with padding
                        const targetLeft = minX - PAD;
                        const targetTop = minY - TOP_PAD;
                        const newWidth = (maxX + PAD) - targetLeft;
                        const newHeight = (maxY + PAD) - targetTop;

                        // Shift delta: how much the frame origin needs to move
                        const shiftX = targetLeft;
                        const shiftY = targetTop;

                        // If the frame origin shifted OR was modified (real-time resize), sync payload
                        if (Math.abs(shiftX) > 0.5 || Math.abs(shiftY) > 0.5 || modifiedFrameIds.current.has(parent.id)) {
                            // Move Parent Frame
                            txs.push({
                                type: 'MOVE_NODE',
                                payload: {
                                    id: parent.id,
                                    position: {
                                        x: parent.position.x + shiftX,
                                        y: parent.position.y + shiftY
                                    },
                                    oldPosition: { ...parent.position }
                                }
                            });

                            // Adjust Siblings
                            siblings.forEach(child => {
                                txs.push({
                                    type: 'MOVE_NODE',
                                    payload: {
                                        id: child.id,
                                        position: {
                                            x: child.position.x - shiftX,
                                            y: child.position.y - shiftY
                                        },
                                        oldPosition: { ...child.position }
                                    }
                                });
                            });

                            // Adjust Dragged Node (finalPos) logic locally
                            finalPos.x -= shiftX;
                            finalPos.y -= shiftY;
                        }

                        // Update frame dimensions
                        txs.push({
                            type: 'UPDATE_NODE_DATA',
                            payload: { id: parent.id, data: { width: Math.round(newWidth), height: Math.round(newHeight) } }
                        });
                    }
                }



                const initPos = initialPositions.current.get(node.id)!;
                txs.push({
                    type: 'MOVE_NODE',
                    payload: { id: node.id, position: finalPos, oldPosition: { ...initPos } }
                });
            }
        });

        if (txs.length > 0) {
            Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });
        }

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
    }, [getNodes]);

    const cancelGrab = useCallback(() => {
        const positionsToRestore = new Map(initialPositions.current);
        const framesToRestore = new Map(initialFrameStates.current);

        setNodes(nodes => nodes.map(n => {
            // Restore Frames
            if (framesToRestore.has(n.id)) {
                return framesToRestore.get(n.id)!;
            }
            // Restore Nodes
            const init = positionsToRestore.get(n.id);
            if (init) {
                return { ...n, position: init };
            }
            return n;
        }));
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
    const { handleModalMouseUp } = useModalAction(
        useCallback(() => {
            if (['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) {
                confirmGrab();
            }
        }, [mode, confirmGrab]),
        useCallback(() => {
            if (['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) {
                cancelGrab();
            }
        }, [mode, cancelGrab]),
        ['GRABBING', 'SCALING', 'ROTATING'].includes(mode)
    );

    const handleMouseUp = useCallback((e: MouseEvent) => {
        // Click-to-Select Logic (Deselect others if clicking a selected node without dragging)
        if (mode === 'IDLE' && pendingGrabStart.current) {
            const target = e.target as HTMLElement;
            const nodeElement = target.closest('.react-flow__node');
            if (nodeElement) {
                const nodeId = nodeElement.getAttribute('data-id');
                // Only if modifiers are NOT held (standard click behavior)
                if (nodeId && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                    selectNode(nodeId, true); // Exclusive selection
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
        groupSelected,
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
        handleMouseUp
    };
}
