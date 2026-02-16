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
        deleteSelected, resetSelected, groupSelected,
        detachSelected, swapConnections,
        clearSelection, selectNode,
    } = useSelection();
    const { cutPath, startCut, updateCut, endCut } = useKnife();

    // --- Transform State ---
    const initialPositions = useRef<Map<string, XYPosition>>(new Map());
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

    // --- Transform Helpers ---
    const applyMove = useCallback((dx: number, dy: number) => {
        setNodes((nodes) => nodes.map((node) => {
            const initialPos = initialPositions.current.get(node.id);
            if (!initialPos) return node;
            return {
                ...node,
                position: { x: initialPos.x + dx, y: initialPos.y + dy },
                measured: node.measured
            };
        }));
    }, [setNodes]);

    const getCentroid = (nodes: Node[]): XYPosition => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            const w = n.measured?.width ?? 150;
            const h = n.measured?.height ?? 50;
            minX = Math.min(minX, n.position.x);
            maxX = Math.max(maxX, n.position.x + w);
            minY = Math.min(minY, n.position.y);
            maxY = Math.max(maxY, n.position.y + h);
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

        setNodes((nodes) => nodes.map(((node) => {
            const initialPos = initialPositions.current.get(node.id);
            if (!initialPos) return node;

            const w = node.measured?.width ?? node.width ?? 150;
            const h = node.measured?.height ?? node.height ?? 50;
            const initialCenterX = initialPos.x + w / 2;
            const initialCenterY = initialPos.y + h / 2;
            const dx = initialCenterX - center.x;
            const dy = initialCenterY - center.y;
            const newCenterX = center.x + dx * sx;
            const newCenterY = center.y + dy * sy;

            return {
                ...node,
                position: { x: newCenterX - w / 2, y: newCenterY - h / 2 }
            };
        })));
    }, [setNodes, axisLock]);

    const applyRotate = useCallback((angleRad: number) => {
        const center = centerRef.current;
        if (!center) return;

        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);

        setNodes((nodes) => nodes.map(((node) => {
            const initialPos = initialPositions.current.get(node.id);
            if (!initialPos) return node;

            const w = node.measured?.width ?? node.width ?? 150;
            const h = node.measured?.height ?? node.height ?? 50;
            const initialCenterX = initialPos.x + w / 2;
            const initialCenterY = initialPos.y + h / 2;
            const dx = initialCenterX - center.x;
            const dy = initialCenterY - center.y;
            const newCenterX = center.x + (dx * cos - dy * sin);
            const newCenterY = center.y + (dx * sin + dy * cos);

            return {
                ...node,
                position: { x: newCenterX - w / 2, y: newCenterY - h / 2 }
            };
        })));
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
    const autopan = useCallback(() => {
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

        rafRef.current = requestAnimationFrame(autopan);
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

        initialPositions.current = new Map(selected.map((n) => [n.id, { ...n.position }]));
        startMousePos.current = mousePos;
        startFlowPos.current = project(mousePos);
        setAxisLock(null);
        setMode('GRABBING');
    }, [getNodes, detachSelected, project]);

    const startScale = useCallback((mousePos: XYPosition) => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        initialPositions.current = new Map(selected.map((n) => [n.id, { ...n.position }]));
        centerRef.current = getCentroid(selected);
        startMousePos.current = mousePos;
        startFlowPos.current = project(mousePos);
        setMode('SCALING');
    }, [getNodes, project]);

    const startRotate = useCallback((mousePos: XYPosition) => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        initialPositions.current = new Map(selected.map((n) => [n.id, { ...n.position }]));
        centerRef.current = getCentroid(selected);
        const flowStartMouse = project({ x: mousePos.x, y: mousePos.y });
        accumulatedRotation.current = 0;
        lastAngleRef.current = Math.atan2(flowStartMouse.y - centerRef.current.y, flowStartMouse.x - centerRef.current.x);

        startMousePos.current = mousePos;
        setMode('ROTATING');
    }, [getNodes, project]);

    const confirmGrab = useCallback(() => {
        const nodes = getNodes();
        const txs: Transaction[] = [];

        initialPositions.current.forEach((initPos, id) => {
            const node = nodes.find(n => n.id === id);
            if (node) {
                const dx = node.position.x - initPos.x;
                const dy = node.position.y - initPos.y;
                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                    txs.push({
                        type: 'MOVE_NODE',
                        payload: {
                            id: node.id,
                            position: { ...node.position },
                            oldPosition: { ...initPos }
                        }
                    });
                }
            }
        });

        if (txs.length > 0) {
            const brain = Brain.getInstance();
            if (txs.length === 1) {
                brain.applyTransaction(txs[0]);
            } else {
                brain.applyTransaction({ type: 'BATCH', payload: txs });
            }
        }

        setMode('IDLE');
        initialPositions.current.clear();
        startMousePos.current = null;
        startFlowPos.current = null;
        centerRef.current = null;
        setAxisLock(null);
        setTransformBuffer('');
        setTransformValue('');
    }, [getNodes]);

    const cancelGrab = useCallback(() => {
        const positionsToRestore = new Map(initialPositions.current);

        setNodes(nodes => nodes.map(n => {
            const init = positionsToRestore.get(n.id);
            if (init) {
                return { ...n, position: init };
            }
            return n;
        }));
        setMode('IDLE');
        initialPositions.current.clear();
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

    const handleMouseUp = useCallback((e: MouseEvent) => {
        pendingGrabStart.current = null;
        if (mode === 'CUTTING') {
            endCut();
            setMode('IDLE');
        } else if (mode === 'GRABBING') {
            confirmGrab();
        }
    }, [mode, endCut, confirmGrab]);

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
