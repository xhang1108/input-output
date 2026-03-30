import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow, Node, XYPosition } from '@xyflow/react';
import { useCanvasProjection } from '../useCanvasProjection';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { Transaction } from '../../engine/types';
import { useHistoryStore, InteractionMode as HistoryMode } from '../../store/useHistoryStore';
import { useClipboard } from '../useClipboard';
import { useSelection } from '../useSelection';
import { useKnife } from '../useKnife';

type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';

/**
 * useHand — Gesture Orchestrator
 * Manages grab/scale/rotate transforms, autopan, mouse events,
 * and composes useClipboard, useSelection, useKnife.
 */
export function useHand() {
    const { getNodes, setNodes, getViewport, setViewport } = useReactFlow();
    const brain = useBrain();
    const { project } = useCanvasProjection();
    const { interactionMode, setInteractionMode, push: pushHistory } = useHistoryStore();
    
    // Internal UI local mode for rapid state (rAF loops)
    const [mode, _setMode] = useState<HistoryMode>('IDLE');

    const setMode = useCallback((newMode: HistoryMode) => {
        _setMode(newMode);
        setInteractionMode(newMode);
    }, [setInteractionMode]);

    // --- Composed Hooks ---
    const { duplicateSelected, copyToClipboard, pasteFromClipboard } = useClipboard();
    const {
        deleteSelected, resetSelected,
        detachSelected, swapConnections,
        alignSelectedNodes,
        clearSelection, selectNode,
    } = useSelection();
    const { cutPath, startCut, updateCut, endCut } = useKnife();

    // --- Transform State ---
    const initialPositions = useRef<Map<string, XYPosition>>(new Map());
    const initialAbsolutePositions = useRef<Map<string, XYPosition>>(new Map());
    const initialDimensions = useRef<Map<string, { w: number, h: number }>>(new Map());
    const initialRotations = useRef<Map<string, number>>(new Map());

    const startMousePos = useRef<XYPosition | null>(null);
    const startFlowPos = useRef<XYPosition | null>(null);
    const centerRef = useRef<XYPosition | null>(null);
    const [axisLock, setAxisLock] = useState<'X' | 'Y' | null>(null);
    const lastCancelTimestamp = useRef<number>(0);

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


    // --- Transform Helpers ---
    const getAbsolutePosition = useCallback(function getAbs(nodeId: string, nodeMap: Map<string, Node>): XYPosition {
        const node = nodeMap.get(nodeId);
        if (!node) return { x: 0, y: 0 };
        return node.position;
    }, []);



    const applyMove = useCallback((dx: number, dy: number) => {
        setNodes((currentNodes) => {
            const nodeMap = new Map(currentNodes.map(n => [n.id, n]));

            // 1. Update Moved Nodes
            initialPositions.current.forEach((initPos, id) => {
                const node = nodeMap.get(id);
                if (node) {
                    const newPos = { x: initPos.x + dx, y: initPos.y + dy };
                    nodeMap.set(id, { ...node, position: newPos, measured: node.measured });
                }
            });

            return Array.from(nodeMap.values());
        });
    }, [setNodes]);

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

    const applyScale = useCallback((scaleFactor: number) => {
        const center = centerRef.current;
        if (!center) return;

        let sx = scaleFactor;
        let sy = scaleFactor;
        if (axisLock === 'X') sy = 1;
        if (axisLock === 'Y') sx = 1;

        setNodes((nodes) => {
            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            const nextAbsolutePositions = new Map<string, XYPosition>();

            // 1. Calculate Orbital Positions (Collapse-Safe)
            initialAbsolutePositions.current.forEach((initAbsPos, id) => {
                const node = nodeMap.get(id);
                if (!node) return;

                // Relative Vector from selection pivot
                const rx = initAbsPos.x - center.x;
                const ry = initAbsPos.y - center.y;

                // Pivot + (Vector * s)
                nextAbsolutePositions.set(id, {
                    x: center.x + rx * sx,
                    y: center.y + ry * sy
                });
            });

            // 2. Apply updates
            return nodes.map(node => {
                const nextPos = nextAbsolutePositions.get(node.id);
                if (!nextPos) return node;

                return {
                    ...node,
                    position: nextPos
                };
            });
        });
    }, [setNodes, axisLock, getAbsolutePosition]);

    const applyRotate = useCallback((angleRad: number) => {
        const center = centerRef.current;
        if (!center) return;

        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        setNodes((nodes) => {
            const nextAbsolutePositions = new Map<string, XYPosition>();

            // 1. Calculate Orbital Position ONLY (Nodes stay upright)
            initialAbsolutePositions.current.forEach((initAbsPos, id) => {
                const dx = initAbsPos.x - center.x;
                const dy = initAbsPos.y - center.y;

                const nextX = center.x + (dx * cos - dy * sin);
                const nextY = center.y + (dx * sin + dy * cos);

                nextAbsolutePositions.set(id, { x: nextX, y: nextY });
            });

            // 2. Apply updates
            return nodes.map(node => {
                const nextPos = nextAbsolutePositions.get(node.id);
                if (nextPos === undefined) return node;

                return {
                    ...node,
                    position: nextPos
                };
            });
        });
    }, [setNodes]);


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

            if (ctrlKey) {
                const GRID_SIZE = config.interaction.snapGridSize;
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
            const pivot = centerRef.current;

            // Use distance from the Red-Dot (Pivot) as the scaling lever
            const startDist = Math.hypot(flowStartMouse.x - pivot.x, flowStartMouse.y - pivot.y);
            const currentDist = Math.hypot(currentFlowPos.x - pivot.x, currentFlowPos.y - pivot.y);

            const scale = startDist > 0 ? currentDist / startDist : 1;
            setTransformValue(scale.toFixed(2));
            applyScale(scale);

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
    const startGrab = useCallback((mousePos: XYPosition, isAltHeld: boolean = false, overrideNodes?: Node[], isExplicit: boolean = false) => {
        const nodes = getNodes();
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

        initialPositions.current = new Map(selected.map((n) => [n.id, { ...n.position }]));
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

        initialRotations.current = new Map(selected.map((n) => [
            n.id,
            (n.data?.rotation as number) || 0
        ]));

        // Store Dimensions for stability
        initialDimensions.current = new Map(selected.map((n) => [
            n.id,
            {
                w: n.measured?.width ?? n.width ?? 150,
                h: n.measured?.height ?? n.height ?? 50
            }
        ]));

        centerRef.current = getPivot(selected, nodeMap);
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

        initialRotations.current = new Map(selected.map((n) => [
            n.id,
            (n.data?.rotation as number) || 0
        ]));

        // Store Dimensions for stability
        initialDimensions.current = new Map(selected.map((n) => [
            n.id,
            {
                w: n.measured?.width ?? n.width ?? 150,
                h: n.measured?.height ?? n.height ?? 50
            }
        ]));

        centerRef.current = getPivot(selected, nodeMap);

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

        if (movedNodeIds.size === 0) {
            console.log(`[Hand] confirmGrab: No nodes moved significantly.`);
            setMode('IDLE');
            startMousePos.current = null;
            return;
        }

        // 2. Build transactions (Position Only)
        movedNodeIds.forEach(id => {
            const node = nodeMap.get(id);
            if (!node) return;
            
            txs.push({ type: 'MOVE_NODE', payload: { id, position: node.position } });
        });

        if (txs.length > 0) {
            brain.applyTransaction({ type: 'BATCH', payload: txs });

            const invTxs: Transaction[] = [];
            initialAbsolutePositions.current.forEach((_, id) => {
                const initNode = nodes.find(n => n.id === id);
                if (initNode) {
                    const initPos = initialPositions.current.get(id);
                    if (initPos) {
                        invTxs.push({ type: 'MOVE_NODE', payload: { id, position: { ...initPos }, parentId: initNode.parentId || null } });
                    }
                }
            });
            initialDimensions.current.forEach((initDim, id) => {
                invTxs.push({ type: 'UPDATE_NODE_DATA', payload: { id, data: { width: initDim.w, height: initDim.h } } });
            });

            console.log(`[Hand] Pushing history: Transform ${movedNodeIds.size} items`, { forward: txs, inverse: invTxs });
            pushHistory({
                id: `transform_${Date.now()}`,
                description: `Transform ${movedNodeIds.size} items`,
                forward: txs, 
                inverse: invTxs
            });
        }

        isResolvingRef.current = true;
        setTimeout(() => { isResolvingRef.current = false; }, 100);

        setMode('IDLE');
        initialPositions.current.clear();
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
        const framesToRestore = new Map(); // Empty stub

        if (positionsToRestore.size === 0 && framesToRestore.size === 0) {
            setMode('IDLE');
            return;
        }

        setNodes(nodes => nodes.map(n => {
            // Restore Frames
            if (framesToRestore.has(n.id)) {
                return { ...framesToRestore.get(n.id)! };
            }
            // Restore Nodes (Position Only)
            const initPos = positionsToRestore.get(n.id);
            if (initPos) {
                return { 
                    ...n, 
                    position: initPos
                };
            }
            return n;
        }));

        isResolvingRef.current = true;
        setTimeout(() => { isResolvingRef.current = false; }, 100);

        setMode('IDLE');
        initialPositions.current.clear();
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

        // Note: React Flow uses button 1 for middle-click and 2 for right-click in panOnDrag
        // We allow these to pass through unless Ctrl+RightClick is used for cutting
        if ((e.button === 1 || e.button === 2) && !(e.ctrlKey && e.button === 2)) return;

        if (e.ctrlKey && e.button === 2) {
            setMode('CUTTING');
            startCut({ x: e.clientX, y: e.clientY });
            return;
        }

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
            const config = brain.getPhysicsConfig();
            if (dist > config.interaction.dragThreshold) {
                startGrab(pendingGrabStart.current, pendingGrabStart.current.altKey, undefined, false);
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
        transformBuffer,
        transformValue,
        startGrab,
        startScale,
        startRotate,
        confirmGrab,
        cancelGrab,
        duplicateSelected,

        copyToClipboard,
        pasteFromClipboard,
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
