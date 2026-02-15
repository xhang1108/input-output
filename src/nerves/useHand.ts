import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow, Node, XYPosition, Edge } from '@xyflow/react';
import { useCanvasProjection } from '../hooks/useCanvasProjection';
import { generateNodeId } from '../utils/idGenerator';
import { Brain } from '../engine/Brain';
import { Transaction } from '../engine/types';

type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';

const CLIPBOARD_KEY = 'calctopus_clipboard';

export function useHand() {
    const { getNodes, setNodes, getEdges, setEdges, getViewport, setViewport } = useReactFlow();
    const { getEventFlowPos, getCurrentZoom, project } = useCanvasProjection();
    const [mode, setMode] = useState<InteractionMode>('IDLE');

    // Formatting for "Ghost" movement
    const initialPositions = useRef<Map<string, XYPosition>>(new Map());
    const startMousePos = useRef<XYPosition | null>(null);
    const startFlowPos = useRef<XYPosition | null>(null); // Canvas-space start pos
    const centerRef = useRef<XYPosition | null>(null); // Pivot for Scale/Rotate
    const [axisLock, setAxisLock] = useState<'X' | 'Y' | null>(null);

    // Knife Path Data
    const cutPathRef = useRef<XYPosition[]>([]);
    const [cutPath, setCutPath] = useState<XYPosition[]>([]);

    // Numeric Transform Buffer
    const [transformBuffer, setTransformBuffer] = useState<string>('');
    const [transformValue, setTransformValue] = useState<string>(''); // Display value (Buffer or Mouse)

    // Rotation Winding Logic
    const accumulatedRotation = useRef(0);
    const lastAngleRef = useRef(0);

    // Drag Initiation Logic
    const pendingGrabStart = useRef<{ x: number, y: number, altKey: boolean } | null>(null);

    // Autopan Logic
    const mousePosRef = useRef<XYPosition | null>(null);
    const rafRef = useRef<number | null>(null);


    // --- Command: Move (Internal Helper) ---
    const applyMove = useCallback((dx: number, dy: number) => {
        setNodes((nodes) => nodes.map((node) => {
            const initialPos = initialPositions.current.get(node.id);
            if (!initialPos) return node;

            return {
                ...node,
                position: {
                    x: initialPos.x + dx,
                    y: initialPos.y + dy,
                },
                measured: node.measured
            };
        }));
    }, [setNodes]);

    // --- Scale/Rotate Helpers ---
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

        // Determine effective scale per axis based on lock
        let sx = scaleFactor;
        let sy = scaleFactor;

        if (axisLock === 'X') sy = 1; // Lock Y axis (scale only X)
        if (axisLock === 'Y') sx = 1; // Lock X axis (scale only Y)

        setNodes((nodes) => nodes.map(((node) => {
            const initialPos = initialPositions.current.get(node.id);
            if (!initialPos) return node;

            const w = node.measured?.width ?? node.width ?? 150;
            const h = node.measured?.height ?? node.height ?? 50;

            // Calculate initial visual center
            const initialCenterX = initialPos.x + w / 2;
            const initialCenterY = initialPos.y + h / 2;

            const dx = initialCenterX - center.x;
            const dy = initialCenterY - center.y;

            // Scale distance from center
            const newCenterX = center.x + dx * sx;
            const newCenterY = center.y + dy * sy;

            return {
                ...node,
                position: {
                    x: newCenterX - w / 2,
                    y: newCenterY - h / 2
                }
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

            // Calculate initial visual center
            const initialCenterX = initialPos.x + w / 2;
            const initialCenterY = initialPos.y + h / 2;

            const dx = initialCenterX - center.x;
            const dy = initialCenterY - center.y;

            // Rotate point (dx, dy)
            const newCenterX = center.x + (dx * cos - dy * sin);
            const newCenterY = center.y + (dx * sin + dy * cos);

            return {
                ...node,
                position: {
                    x: newCenterX - w / 2,
                    y: newCenterY - h / 2
                }
            };
        })));
    }, [setNodes]);


    // --- Helper: Clone Nodes (Internal) ---
    const cloneNodes = useCallback((nodesToClone: Node[], offset: { x: number, y: number } = { x: 0, y: 0 }) => {
        const idMap = new Map<string, string>();

        const newNodes = nodesToClone.map(node => {
            const newId = generateNodeId(node.type || 'baseNode');
            idMap.set(node.id, newId);
            return {
                ...node,
                id: newId,
                selected: true,
                position: {
                    x: node.position.x + offset.x,
                    y: node.position.y + offset.y
                },
                data: JSON.parse(JSON.stringify(node.data)),
                style: node.style ? JSON.parse(JSON.stringify(node.style)) : undefined
            };
        });

        // Handle Parent/Child relationships for Frames
        newNodes.forEach(node => {
            if (node.parentId && idMap.has(node.parentId)) {
                node.parentId = idMap.get(node.parentId);
            }
        });

        return newNodes;
    }, []);

    // --- Command: Duplicate (Immediate) ---
    const duplicateSelected = useCallback((): Node[] | false => {
        const nodes = getNodes();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return false;

        const newNodes = cloneNodes(selectedNodes, { x: 0, y: 0 }); // Start at same pos for Grab to take over

        setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
        return newNodes;
    }, [getNodes, setNodes, cloneNodes]);

    // --- Command: Delete Selected ---
    const deleteSelected = useCallback(() => {
        const nodes = getNodes();
        const selectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));

        if (selectedNodeIds.size === 0) return;

        setNodes(nds => nds.filter(n => !selectedNodeIds.has(n.id)));
        setEdges(eds => eds.filter(e => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
    }, [getNodes, setNodes, setEdges]);

    // --- Command: Reset Selected Data (Backspace) ---
    const resetSelected = useCallback(() => {
        setNodes(nds => nds.map(n => {
            if (!n.selected) return n;
            return {
                ...n,
                data: {
                    ...n.data,
                    label: n.type === 'frame' ? 'Group' : 'Node' // Simple reset for Phase 0
                }
            };
        }));
    }, [setNodes]);

    // --- Command: Copy to Clipboard ---
    const copyToClipboard = useCallback(() => {
        const nodes = getNodes();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;
        const payload = JSON.stringify(selectedNodes);
        localStorage.setItem(CLIPBOARD_KEY, payload);
    }, [getNodes]);

    // --- Command: Paste from Clipboard ---
    const pasteFromClipboard = useCallback(() => {
        const payload = localStorage.getItem(CLIPBOARD_KEY);
        if (!payload) return;

        try {
            const clipboardNodes = JSON.parse(payload) as Node[];
            if (!Array.isArray(clipboardNodes)) return;

            const newNodes = cloneNodes(clipboardNodes, { x: 20, y: 20 });
            setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
        } catch (e) {
            console.error("Failed to paste nodes", e);
        }
    }, [setNodes, cloneNodes]);



    // --- Command: Group Nodes (Frames) ---
    const groupSelected = useCallback(() => {
        const nodes = getNodes();
        const selectedNodes = nodes.filter(n => n.selected && n.type !== 'frame' && !n.parentId);

        if (selectedNodes.length === 0) return;

        // 1. Calculate Bounding Box
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        selectedNodes.forEach(node => {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            const w = node.measured?.width ?? 150;
            const h = node.measured?.height ?? 50;
            maxX = Math.max(maxX, node.position.x + w);
            maxY = Math.max(maxY, node.position.y + h);
        });

        const PADDING = 50;
        minX -= PADDING;
        minY -= PADDING + 30;
        maxX += PADDING;
        maxY += PADDING;

        const width = maxX - minX;
        const height = maxY - minY;

        const frameId = generateNodeId('frame');
        const frameNode: Node = {
            id: frameId,
            type: 'frame',
            position: { x: minX, y: minY },
            data: { label: 'Group', width, height },
            style: { width, height, zIndex: -100 }, // Deep background
            selected: true,
        };

        const updatedChildren = selectedNodes.map(node => ({
            ...node,
            selected: false,
            parentId: frameId,
            extent: 'parent' as const, // Optional: keep inside frame
            position: {
                x: node.position.x - minX,
                y: node.position.y - minY,
            },
            style: { ...node.style, zIndex: 100 } // Ensure on top of frame
        }));

        setNodes(nds => {
            const others = nds.filter(n => !selectedNodes.find(sn => sn.id === n.id));
            return [...others, frameNode, ...updatedChildren];
        });

    }, [getNodes, setNodes]);

    // --- Command: Detach (Alt + Drag) ---
    const detachSelected = useCallback(() => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        const selectedIds = new Set(selected.map(n => n.id));
        setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
    }, [getNodes, setEdges]);

    // --- Command: Swap Inputs (Alt + S) ---
    const swapConnections = useCallback(() => {
        const selectedNodes = getNodes().filter(n => n.selected);
        if (selectedNodes.length !== 1) return;

        const targetId = selectedNodes[0].id;
        const edges = getEdges();

        const edgeA = edges.find(e => e.target === targetId && e.targetHandle === 'in_a');
        const edgeB = edges.find(e => e.target === targetId && e.targetHandle === 'in_b');

        if (edgeA && edgeB) {
            const txs: Transaction[] = [
                { type: 'DISCONNECT', payload: edgeA.id },
                { type: 'DISCONNECT', payload: edgeB.id },
                {
                    type: 'CONNECT',
                    payload: { ...edgeA, id: `edge-${Date.now()}-a`, source: edgeB.source, sourceHandle: edgeB.sourceHandle }
                },
                {
                    type: 'CONNECT',
                    payload: { ...edgeB, id: `edge-${Date.now()}-b`, source: edgeA.source, sourceHandle: edgeA.sourceHandle }
                }
            ];
            Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });

        } else if (edgeA && !edgeB) {
            const txs: Transaction[] = [
                { type: 'DISCONNECT', payload: edgeA.id },
                {
                    type: 'CONNECT',
                    payload: { ...edgeA, id: `edge-${Date.now()}-mov`, targetHandle: 'in_b' }
                }
            ];
            Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });

        } else if (!edgeA && edgeB) {
            const txs: Transaction[] = [
                { type: 'DISCONNECT', payload: edgeB.id },
                {
                    type: 'CONNECT',
                    payload: { ...edgeB, id: `edge-${Date.now()}-mov`, targetHandle: 'in_a' }
                }
            ];
            Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });
        }

    }, [getNodes, getEdges]);


    // --- Selection Helpers ---
    const clearSelection = useCallback(() => {
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
    }, [setNodes]);

    const selectNode = useCallback((id: string, exclusive: boolean = true) => {
        setNodes(nds => {
            const targetNode = nds.find(n => n.id === id);
            if (!targetNode) return nds;

            const currentlySelectedIds = new Set(nds.filter(n => n.selected).map(n => n.id));
            const newSelectedIds = new Set(exclusive ? [id] : [...currentlySelectedIds, id]);

            const unselected = nds.filter(n => !newSelectedIds.has(n.id)).map(n => ({ ...n, selected: false }));
            const selected = nds.filter(n => newSelectedIds.has(n.id)).map(n => ({ ...n, selected: true }));

            const selectedOthers = selected.filter(n => n.id !== id);
            const target = selected.find(n => n.id === id)!;

            return [...unselected, ...selectedOthers, target];
        });
    }, [setNodes]);


    // --- Knife Tool Logic ---
    const startCut = useCallback((pos: XYPosition) => {
        setMode('CUTTING');
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

        setMode('IDLE');
        cutPathRef.current = [];
        setCutPath([]);
    }, [getEdges, getNodes, setEdges, project]);


    // --- Interaction Core (Shared) ---
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
            setViewport({
                ...vp,
                x: vp.x + panX,
                y: vp.y + panY
            });
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
        if (mode === 'CUTTING') endCut();
        else if (mode === 'GRABBING') confirmGrab();
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

function linesIntersect(a: number, b: number, c: number, d: number, p: number, q: number, r: number, s: number) {
    const det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) return false;
    const lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
    const gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}
