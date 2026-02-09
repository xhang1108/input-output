import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow, Node, XYPosition, Edge } from '@xyflow/react';
import { useCanvasProjection } from '../hooks/useCanvasProjection';
import { nanoid } from 'nanoid';

type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';

const CLIPBOARD_KEY = 'calctopus_clipboard';

export function useHand() {
    const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();
    const { getEventFlowPos, getCurrentZoom, project } = useCanvasProjection();
    const [mode, setMode] = useState<InteractionMode>('IDLE');

    // Formatting for "Ghost" movement
    const initialPositions = useRef<Map<string, XYPosition>>(new Map());
    const startMousePos = useRef<XYPosition | null>(null);
    const centerRef = useRef<XYPosition | null>(null); // Pivot for Scale/Rotate
    const [axisLock, setAxisLock] = useState<'X' | 'Y' | null>(null);

    // Knife Path Data
    const cutPathRef = useRef<XYPosition[]>([]);
    const [cutPath, setCutPath] = useState<XYPosition[]>([]);

    // Numeric Transform Buffer
    const [transformBuffer, setTransformBuffer] = useState<string>('');
    const [transformValue, setTransformValue] = useState<string>(''); // Display value (Buffer or Mouse)

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
            const newId = nanoid();
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
    const duplicateSelected = useCallback(() => {
        const nodes = getNodes();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return false;

        const newNodes = cloneNodes(selectedNodes, { x: 0, y: 0 }); // Start at same pos for Grab to take over

        setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
        return true;
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

        const frameId = nanoid();
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

        // Important: Add Frame FIRST, then children? 
        // Or remove old children instances and add updated ones.
        // We filter out original selectedNodes, then add updatedChildren + frameNode.

        setNodes(nds => {
            const others = nds.filter(n => !selectedNodes.find(sn => sn.id === n.id));
            return [...others, frameNode, ...updatedChildren];
        });

    }, [getNodes, setNodes]);


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

            // Convert Screen Path to Flow Path for Intersection Check
            const flowPath = path.map(p => ({ x: p.x, y: p.y })); // This path is actually screen-space
            const projectedPath = path.map(p => project({ x: p.x, y: p.y }));

            edges.forEach(edge => {
                const sourceNode = nodes.find(n => n.id === edge.source);
                const targetNode = nodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode) return;

                // For interactions with Frames or Kids, we need absolute positions?
                // Standard nodes have absolute positions if no parent. 
                // If parent, we need to calculate absolute?
                // For now, let's assume knife only cuts top-level or check absolute.
                // NOTE: This knife logic might break for child nodes if we don't handle parent offset.
                // Phase 0.6 fix: Ignore complex parent transforms for knife for now or update later.

                const sx = sourceNode.position.x + (sourceNode.measured?.width || 150);
                const sy = sourceNode.position.y + (sourceNode.measured?.height || 50) / 2;
                const tx = targetNode.position.x;
                const ty = targetNode.position.y + (targetNode.measured?.height || 50) / 2;

                // Check intersection between Edge Line (sx,sy)->(tx,ty) and any segment in Knife Path (Flow Space)
                for (let i = 0; i < projectedPath.length - 1; i++) {
                    const p1 = projectedPath[i];
                    const p2 = projectedPath[i + 1];
                    if (linesIntersect(sx, sy, tx, ty, p1.x, p1.y, p2.x, p2.y)) {
                        edgesToRemove.push(edge.id);
                        break; // Cut this edge
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
    }, [getEdges, getNodes, setEdges, getEventFlowPos]);

    // --- Command: Swap Inputs (Alt + S) ---
    const swapConnections = useCallback(() => {
        const selectedNodes = getNodes().filter(n => n.selected);
        if (selectedNodes.length !== 1) return; // Only support single node swap for now

        const targetId = selectedNodes[0].id;
        const edges = getEdges();

        // Find edges connected to Input A and Input B
        const edgeA = edges.find(e => e.target === targetId && e.targetHandle === 'in-a');
        const edgeB = edges.find(e => e.target === targetId && e.targetHandle === 'in-b');

        if (edgeA && edgeB) {
            // Swap their sources
            setEdges(eds => eds.map(e => {
                if (e.id === edgeA.id) return { ...e, source: edgeB.source, sourceHandle: edgeB.sourceHandle };
                if (e.id === edgeB.id) return { ...e, source: edgeA.source, sourceHandle: edgeA.sourceHandle };
                return e;
            }));
        } else if (edgeA && !edgeB) {
            // Move A to B
            setEdges(eds => eds.map(e => e.id === edgeA.id ? { ...e, targetHandle: 'in-b' } : e));
        } else if (!edgeA && edgeB) {
            // Move B to A
            setEdges(eds => eds.map(e => e.id === edgeB.id ? { ...e, targetHandle: 'in-a' } : e));
        }

    }, [getNodes, getEdges, setEdges]);


    // --- Command: Detach (Alt + Drag) ---
    const detachSelected = useCallback(() => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        const selectedIds = new Set(selected.map(n => n.id));
        setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
    }, [getNodes, setEdges]);

    // --- Interaction Triggers ---

    const startGrab = useCallback((mousePos: XYPosition, isAltHeld: boolean = false) => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        // Detach Logic (Alt + Drag)
        if (isAltHeld) {
            detachSelected();
        }

        initialPositions.current = new Map(selected.map((n) => [n.id, { ...n.position }]));

        startMousePos.current = mousePos;
        setAxisLock(null); // Reset axis lock
        setMode('GRABBING');
    }, [getNodes, detachSelected]);

    const startScale = useCallback((mousePos: XYPosition) => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        initialPositions.current = new Map(selected.map((n) => [n.id, { ...n.position }]));
        centerRef.current = getCentroid(selected);
        startMousePos.current = mousePos;
        setMode('SCALING');
    }, [getNodes]);

    const startRotate = useCallback((mousePos: XYPosition) => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        initialPositions.current = new Map(selected.map((n) => [n.id, { ...n.position }]));
        centerRef.current = getCentroid(selected);
        startMousePos.current = mousePos;
        setMode('ROTATING');
    }, [getNodes]);


    const confirmGrab = useCallback(() => {
        setMode('IDLE');
        initialPositions.current.clear();
        startMousePos.current = null;
        centerRef.current = null;
        setAxisLock(null);
        setTransformBuffer('');
        setTransformValue('');
    }, []);

    const cancelGrab = useCallback(() => {
        // Create a snapshot because setNodes callback is async and we clear the ref below
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
        centerRef.current = null;
        setAxisLock(null);
        setTransformBuffer('');
        setTransformValue('');
    }, [setNodes]);

    // --- Selection Helpers ---
    const clearSelection = useCallback(() => {
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
    }, [setNodes]);

    const selectNode = useCallback((id: string, exclusive: boolean = true) => {
        setNodes(nds => nds.map(n => {
            if (n.id === id) return { ...n, selected: true };
            return { ...n, selected: exclusive ? false : n.selected };
        }));
    }, [setNodes]);

    // --- Event Handlers (to be attached to Body) ---

    // We need to handle Mouse Down for Knife AND Click-to-Grab
    const handleMouseDown = useCallback((e: MouseEvent) => {
        const target = e.target as HTMLElement;

        // Ignore handles
        if (target.classList.contains('react-flow__handle')) {
            return;
        }

        // 1. Knife Logic (Ctrl + Right Click)
        if (e.ctrlKey && e.button === 2) {
            startCut({ x: e.clientX, y: e.clientY });
            return;
        }

        // 2. Click-to-Grab Logic (Left Click on Node)
        if (e.button === 0) {
            const nodeElement = target.closest('.react-flow__node');
            if (nodeElement) {
                const nodeId = nodeElement.getAttribute('data-id');
                if (nodeId) {
                    const nodes = getNodes();
                    const clickedNode = nodes.find(n => n.id === nodeId);

                    if (clickedNode) {
                        // Selection Logic
                        // If holding Shift/Ctrl, toggle/add selection
                        // If not, select exclusive (unless already selected, then keep selection separate from grab init?)
                        // Standard behavior: 
                        // - Click unselected -> Select Exclusive
                        // - Click selected -> Keep selection (for multi-drag)

                        if (!e.shiftKey && !e.ctrlKey) {
                            if (!clickedNode.selected) {
                                selectNode(nodeId, true);
                            }
                        } else {
                            // Toggle or Add? Standard is toggle or add.
                            // React Flow standard: Click selected with shift -> deselect? 
                            // userHand doesn't have toggle helper yet.
                            // Let's implement simple Add for now.
                            selectNode(nodeId, false);
                        }

                        // Trigger Grab
                        startGrab({ x: e.clientX, y: e.clientY }, e.altKey);
                    }
                }
            }
        }
    }, [startCut, startGrab, getNodes, selectNode]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const currentMousePos = { x: e.clientX, y: e.clientY };

        if (mode === 'CUTTING') {
            updateCut(currentMousePos);
        } else if (mode === 'GRABBING' && startMousePos.current) {
            // Priority: Transform Buffer > Mouse
            if (transformBuffer !== '') {
                // Buffer exists, ignore mouse for positioning (but we might want to update display if we were doing something else? No, buffer is truth)
                return;
            };

            const zoom = getCurrentZoom();
            let dx = (currentMousePos.x - startMousePos.current.x) / zoom;
            let dy = (currentMousePos.y - startMousePos.current.y) / zoom;

            // Axis Lock Logic
            if (axisLock === 'X') dy = 0;
            if (axisLock === 'Y') dx = 0;

            // Intelligent Snapping (Ctrl held)
            if (e.ctrlKey) {
                const GRID_SIZE = 20;
                dx = Math.round(dx / GRID_SIZE) * GRID_SIZE;
                dy = Math.round(dy / GRID_SIZE) * GRID_SIZE;
            }

            // Update Display Value
            // Calculate Euclidean distance or Axis distance?
            // User likely wants "Distance Moved". 
            // If Axis Locked, show that axis distance.
            // If Free, show X or Distance? 
            // Let's show Distance for now, or tuple if needed.
            // Actually, Blender shows "D: 1.0000 (1.0000, 0.0000, 0.0000)"
            // Simple: just show Delta.
            let displayVal = '';
            if (axisLock === 'X') displayVal = `${Math.round(dx)}`;
            else if (axisLock === 'Y') displayVal = `${Math.round(dy)}`;
            else displayVal = `${Math.round(dx)}, ${Math.round(dy)}`; // Show Tuple

            setTransformValue(displayVal);
            applyMove(dx, dy);

        } else if (mode === 'SCALING' && startMousePos.current && centerRef.current) {
            if (transformBuffer !== '') return;

            const flowMouse = getEventFlowPos(e);
            const flowStartMouse = project({ x: startMousePos.current.x, y: startMousePos.current.y });
            const center = centerRef.current;

            const startDist = Math.hypot(flowStartMouse.x - center.x, flowStartMouse.y - center.y);
            const currentDist = Math.hypot(flowMouse.x - center.x, flowMouse.y - center.y);

            const scale = startDist > 0 ? currentDist / startDist : 1;
            setTransformValue(scale.toFixed(2));
            applyScale(scale);

        } else if (mode === 'ROTATING' && startMousePos.current && centerRef.current) {
            if (transformBuffer !== '') return;

            const flowMouse = getEventFlowPos(e);
            const flowStartMouse = project({ x: startMousePos.current.x, y: startMousePos.current.y });
            const center = centerRef.current;

            const startAngle = Math.atan2(flowStartMouse.y - center.y, flowStartMouse.x - center.x);
            const currentAngle = Math.atan2(flowMouse.y - center.y, flowMouse.x - center.x);

            const angleDiff = currentAngle - startAngle;
            const deg = (angleDiff * 180 / Math.PI) % 360;
            setTransformValue(deg.toFixed(1) + '°');
            applyRotate(angleDiff);
        }
    }, [mode, getCurrentZoom, applyMove, applyScale, applyRotate, updateCut, axisLock, getEventFlowPos, transformBuffer]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (mode === 'CUTTING') {
            endCut();
        } else if (mode === 'GRABBING') {
            confirmGrab();
        }
    }, [mode, endCut, confirmGrab]);


    // --- Numeric Type Handler ---
    const handleTypeNum = useCallback((char: string) => {
        if (!['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) return;

        setTransformBuffer(prev => {
            if (char === 'Backspace') return prev.slice(0, -1);
            if (char === '.' && prev.includes('.')) return prev;
            if (char === '-' && prev.includes('-')) return prev.replace('-', '');
            if (char === '-' && !prev.includes('-')) return '-' + prev;
            return prev + char;
        });

        // We set transformValue to buffer content immediately?
        // Actually, let's derive it in useEffect or just set it here too?
        // Issue: 'setTransformBuffer' state update is async.
        // But we can let the useEffect handle it.
        // Wait, if I type '2', buffer is '2'. useEffect runs.
        // useEffect should also update 'transformValue' to match Buffer?
        // Yes.
    }, [mode]);

    // Apply Transform Buffer Effect
    // We need a separate effect to apply the buffer when it changes, 
    // OR we can just call the apply functions here?
    // Better to apply in useEffect so it updates even if mouse doesn't move.

    // Actually, let's just make handleMouseMove apply it if buffer exists,
    // AND create a useEffect that triggers when buffer changes.
    // wait, we can't call applyMove inside useEffect easily if it depends on other refs? 
    // Actually applyMove only depends on setNodes and initialPositions (ref). Safe.

    // 2026-02-09: We will use a dedicated effect for buffer application
    useEffect(() => {
        if (transformBuffer === '' && mode !== 'IDLE') {
            // Buffer Cleared -> We do NOT reset Position here, 
            // because mouseMove logic will pick up from where it was? 
            // Or should we reset to mouse pos?
            // Currently, handleMouseMove recalculates from startPos using current mouse pos.
            // So if buffer clears, next mouse move event will "snap" to mouse position.
            // This is acceptable behavior (Blender does this).
            return;
        }

        const val = parseFloat(transformBuffer);
        if (isNaN(val)) return;

        // Update Display Value to match Buffer
        setTransformValue(transformBuffer);

        if (mode === 'GRABBING') {
            // ... existing logic ...
            let dx = 0;
            let dy = 0;

            if (axisLock === 'Y') {
                dy = val; // Pixels
            } else {
                dx = val; // Pixels (Default to X if no lock or X lock)
            }
            applyMove(dx, dy);

        } else if (mode === 'SCALING') {
            applyScale(val);

        } else if (mode === 'ROTATING') {
            const rad = val * (Math.PI / 180);
            applyRotate(rad);
        }

    }, [transformBuffer, mode, axisLock, applyMove, applyScale, applyRotate]);


    return {
        mode,
        cutPath,
        transformBuffer, // Export Buffer (Deprecate if we switch to value?)
        transformValue, // Export Value for UI
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
        clearSelection, // New Export
        selectNode, // New Export
        setAxisLock,
        handleTypeNum, // New Export
        handleMouseMove,
        handleMouseDown,
        handleMouseUp
    };
}

// Minimal Intersection Helper
function linesIntersect(a: number, b: number, c: number, d: number, p: number, q: number, r: number, s: number) {
    var det, gamma, lambda;
    det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) {
        return false;
    } else {
        lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
        gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
        return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    }
}
