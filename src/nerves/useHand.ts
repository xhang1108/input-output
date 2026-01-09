import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useReactFlow, useStoreApi, getSmoothStepPath, Position, type Node, type Edge, type XYPosition } from '@xyflow/react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import {
    createNodeObject,
    getBoundingBox,
    generateOffsetNodes,
    getConnectedEdgeIds,
    scaleNodes,
    rotateNodes,
    getMedianCenter
} from '../utils/graphPhysics';
import { nanoid } from 'nanoid';

// (Math helpers moved to useEye.ts)

// Define the shape of our clipboard data
export const useHand = (
    memories: any,
    setNodesExternal?: (payload: Node[] | ((original: Node[]) => Node[])) => void,
    setEdgesExternal?: (payload: Edge[] | ((original: Edge[]) => Edge[])) => void
) => {
    // We need getEdges from store to implement smart deletion
    const { getNodes, getEdges, setNodes: setNodesInternal, setEdges: setEdgesInternal, screenToFlowPosition } = useReactFlow();
    const store = useStoreApi();

    // Prefer external setters (state) if provided, otherwise internal (store)
    const setNodes = setNodesExternal || setNodesInternal;
    const setEdges = setEdgesExternal || setEdgesInternal;

    const [clipboard, setClipboard] = useState<Node[]>([]);

    // --- Placement State (Internal Motor State) ---
    type HandMode = 'move' | 'scale' | 'rotate';
    const [handMode, setHandMode] = useState<HandMode>('move');
    const [axisLock, setAxisLock] = useState<'x' | 'y' | null>(null);
    const [placingNodeIds, setPlacingNodeIds] = useState<Set<string> | null>(null);
    const placementRef = useRef<{
        startMousePos: { x: number, y: number },
        startFlowPos: { x: number, y: number },
        nodeOffsets: Record<string, { x: number, y: number }>,
        center?: { x: number, y: number }
    } | null>(null);

    // =========================================
    // Level 1: Atomic Actions (Pure-ish State Helpers)
    // =========================================

    const deselectAll = useCallback((nodes: Node[]): Node[] => {
        return nodes.map(n => ({ ...n, selected: false }));
    }, []);

    const getSelectedNodes = useCallback((): Node[] => {
        return getNodes().filter(n => n.selected);
    }, [getNodes]);

    const createNode = useCallback((
        type: string,
        position: XYPosition,
        data: Record<string, unknown>,
        selected: boolean = false
    ): Node => {
        return createNodeObject(type, position, data, selected);
    }, []);

    // =========================================
    // Level 2: Internal State Atoms (Helpers)
    // =========================================

    const _spawnNodes = useCallback((newNodes: Node[]) => {
        // 1. Reset React Flow's internal selection state to prevent event blocking
        store.setState({ nodesSelectionActive: false });

        // 2. Snapshot for Undo
        memories.remember();

        // 2. Add new nodes (selected by default for standard UX)
        setNodes((currentNodes) => {
            const deselected = currentNodes.map(n => ({ ...n, selected: false }));
            return [...deselected, ...newNodes.map(n => ({ ...n, selected: true }))];
        });

        return newNodes.map(n => n.id);
    }, [setNodes, memories, store]);


    const _removeNodes = useCallback((nodesToRemove: Node[]) => {
        if (nodesToRemove.length === 0) return;

        const currentNodes = getNodes();
        const currentEdges = getEdges();

        const nodesToDeleteIds = new Set(nodesToRemove.map(n => n.id));

        // 1. Snapshot State
        memories.remember();

        // 2. Identify Connected Edges
        const edgeIdsToRemove = new Set(getConnectedEdgeIds(currentEdges, nodesToDeleteIds));

        // 2. Remove Edges
        if (edgeIdsToRemove.size > 0) {
            setEdges(eds => eds.filter(e => !edgeIdsToRemove.has(e.id)));
        }

        // 3. Remove Nodes
        setNodes(nds => nds.filter(n => !nodesToDeleteIds.has(n.id)));

    }, [getNodes, getEdges, setNodes, setEdges, memories]);

    // =========================================
    // Level 3: Compound Actions (Public API)
    // =========================================

    // --- Placement Logic (The Follower) ---

    const startPlacing = useCallback((nodeIds: string[], initialMousePos: { x: number, y: number }, mode: HandMode = 'move', initialNodes?: Node[]) => {
        if (!nodeIds || nodeIds.length === 0) return;

        // Use provided nodes (just created) or fetch from store (existing)
        const currentNodes = initialNodes || getNodes();
        const nodesToMove = currentNodes.filter(n => nodeIds.includes(n.id));

        if (nodesToMove.length === 0) {
            console.warn('[Hand] startPlacing failed: No nodes found for IDs', nodeIds);
            return;
        }

        // Select the new nodes
        setNodes((nds) => nds.map(node => ({
            ...node,
            selected: nodeIds.includes(node.id)
        })));

        // Capture initial offsets
        const nodeOffsets: Record<string, { x: number, y: number }> = {};
        nodesToMove.forEach(node => {
            nodeOffsets[node.id] = { x: node.position.x, y: node.position.y };
        });

        // Calculate pivot point (Selection Center / Median Point of centers)
        const center = getMedianCenter(nodesToMove);
        const mouseFlowPos = screenToFlowPosition(initialMousePos);

        setHandMode(mode);
        setAxisLock(null); // Reset lock on start
        setPlacingNodeIds(new Set(nodeIds));
        placementRef.current = {
            startMousePos: initialMousePos,
            startFlowPos: mouseFlowPos,
            nodeOffsets: nodeOffsets,
            center: center
        };
    }, [getNodes, setNodes]);

    const commitPlacement = useCallback(() => {
        setPlacingNodeIds(null);
        setAxisLock(null);
        placementRef.current = null;
    }, []);

    const cancelPlacement = useCallback(() => {
        if (!placementRef.current || !placingNodeIds) return;
        const originalOffsets = placementRef.current.nodeOffsets;

        setNodes((nds) => nds.map(n => {
            if (placingNodeIds.has(n.id)) {
                const originalPos = originalOffsets[n.id];
                if (originalPos) {
                    return { ...n, position: { ...originalPos } };
                }
            }
            return n;
        }));

        setPlacingNodeIds(null);
        setAxisLock(null);
        placementRef.current = null;

        // Trigger logic update to ensure engine is in sync with reverted positions
        setTimeout(() => {
            useAppStore.getState().triggerLogicUpdate();
        }, 0);

        toast('Canceled');
    }, [placingNodeIds, setNodes]);

    // --- Movement Effect (The "Hand" follows the "Cursor") ---
    useEffect(() => {
        if (!placingNodeIds) return;

        const handleMouseMove = (e: MouseEvent) => {
            const currentParams = placementRef.current;
            if (!currentParams) return;

            const { startFlowPos, nodeOffsets, center } = currentParams;
            const currentFlowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

            if (handMode === 'move') {
                let dx = currentFlowPos.x - startFlowPos.x;
                let dy = currentFlowPos.y - startFlowPos.y;

                if (axisLock === 'x') dy = 0;
                if (axisLock === 'y') dx = 0;

                setNodes((nds) => nds.map(n => {
                    if (placingNodeIds.has(n.id)) {
                        const originalPos = nodeOffsets[n.id];
                        if (originalPos) {
                            return {
                                ...n,
                                position: {
                                    x: originalPos.x + dx,
                                    y: originalPos.y + dy
                                }
                            };
                        }
                    }
                    return n;
                }));
            } else if (handMode === 'scale') {
                const pivot = center!;
                const startDist = Math.sqrt(Math.pow(startFlowPos.x - pivot.x, 2) + Math.pow(startFlowPos.y - pivot.y, 2));
                const currentDist = Math.sqrt(Math.pow(currentFlowPos.x - pivot.x, 2) + Math.pow(currentFlowPos.y - pivot.y, 2));

                // Stability: If mouse starts at pivot, scale is 1
                const scaleFactor = startDist < 1 ? 1 : currentDist / startDist;

                setNodes((nds) => scaleNodes(nds, pivot, scaleFactor, nodeOffsets));
            } else if (handMode === 'rotate') {
                const pivot = center!;
                const startDist = Math.sqrt(Math.pow(startFlowPos.x - pivot.x, 2) + Math.pow(startFlowPos.y - pivot.y, 2));

                // Stability: If mouse is too close to pivot, don't rotate (or it will flip wildly)
                if (startDist < 1) return;

                const startAngle = Math.atan2(startFlowPos.y - pivot.y, startFlowPos.x - pivot.x);
                const currentAngle = Math.atan2(currentFlowPos.y - pivot.y, currentFlowPos.x - pivot.x);
                const deltaAngle = currentAngle - startAngle;

                setNodes((nds) => rotateNodes(nds, pivot, deltaAngle, nodeOffsets));
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0) {
                // Left Click: Commit
                e.stopPropagation();
                commitPlacement();
            } else if (e.button === 2) {
                // Right Click: Cancel
                e.preventDefault();
                e.stopPropagation();

                // CRITICAL: Block the upcoming contextmenu event that follows this mousedown/mouseup
                const blockNextMenu = (ce: MouseEvent) => {
                    ce.preventDefault();
                    ce.stopPropagation();
                };
                window.addEventListener('contextmenu', blockNextMenu, { capture: true, once: true });

                cancelPlacement();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (handMode !== 'move') return;

            if (e.key.toLowerCase() === 'x') {
                setAxisLock(prev => prev === 'x' ? null : 'x');
                toast.info(axisLock === 'x' ? 'Axis Lock Disabled' : 'Locked to X Axis');
            } else if (e.key.toLowerCase() === 'y') {
                setAxisLock(prev => prev === 'y' ? null : 'y');
                toast.info(axisLock === 'y' ? 'Axis Lock Disabled' : 'Locked to Y Axis');
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('keydown', handleKeyDown);
        // Safety: Delay attaching mousedown to prevent instant drops if event is leaking
        // (e.g., if the user is still holding Shift+D)
        const timer = setTimeout(() => {
            // Use capture to preempt React Flow or other handlers
            window.addEventListener('mousedown', handleMouseDown, { capture: true });
        }, 100);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleMouseDown, { capture: true });
            clearTimeout(timer);
        };
    }, [handMode, axisLock, placingNodeIds, screenToFlowPosition, setNodes, commitPlacement, cancelPlacement]);

    // --- Selection ---

    const grabAll = useCallback(() => {
        setNodes(nds => nds.map(n => ({ ...n, selected: true })));
    }, [setNodes]);

    // Unified Grab Action (Tries selection first, then hover)
    const grab = useCallback((screenMousePos: { x: number, y: number }, mode: HandMode = 'move') => {
        const selected = getSelectedNodes();
        if (selected.length > 0) {
            startPlacing(selected.map(n => n.id), screenMousePos, mode);
            toast.success(mode.charAt(0).toUpperCase() + mode.slice(1) + 'ing');
            return true;
        }

        const mouseFlowPos = screenToFlowPosition(screenMousePos);
        const currentNodes = getNodes();
        for (let i = currentNodes.length - 1; i >= 0; i--) {
            const n = currentNodes[i];
            const w = n.measured?.width ?? n.width ?? 200;
            const h = n.measured?.height ?? n.height ?? 50;
            if (mouseFlowPos.x >= n.position.x && mouseFlowPos.x <= n.position.x + w &&
                mouseFlowPos.y >= n.position.y && mouseFlowPos.y <= n.position.y + h) {

                startPlacing([n.id], screenMousePos, mode);
                toast.success(mode.charAt(0).toUpperCase() + mode.slice(1) + 'ed');
                return true;
            }
        }
        return false;
    }, [getNodes, getSelectedNodes, screenToFlowPosition, startPlacing]);

    // --- Deletion ---

    const discard = useCallback(() => {
        const selected = getSelectedNodes();
        _removeNodes(selected);
    }, [getSelectedNodes, _removeNodes]);

    // --- Clipboard: Copy / Cut / Paste ---

    const copy = useCallback(() => {
        const selected = getSelectedNodes();
        if (selected.length > 0) {
            // Sanitize: Only copy essential data
            const cleanNodes = selected.map(n => ({
                id: n.id,
                type: n.type,
                position: { ...n.position },
                data: JSON.parse(JSON.stringify(n.data)),
            }));

            setClipboard(cleanNodes as Node[]);
            toast.success(`Copied ${selected.length} node(s)`);
        }
    }, [getSelectedNodes]);

    const cut = useCallback(() => {
        const selected = getSelectedNodes();
        if (selected.length > 0) {
            const cleanNodes = selected.map(n => ({
                id: n.id,
                type: n.type,
                position: { ...n.position },
                data: JSON.parse(JSON.stringify(n.data)),
            }));
            setClipboard(cleanNodes as Node[]);
            _removeNodes(selected);
            toast.success(`Cut ${selected.length} node(s)`);
        }
    }, [getSelectedNodes, _removeNodes]);

    // --- Knife Tool: Sever Edges (Atomic Action) ---
    // Receives identified edges from Eye, and cuts them.
    const sever = useCallback((edgesToCut: Edge[]) => {
        if (edgesToCut.length === 0) return;

        const idsToRemove = new Set(edgesToCut.map(e => e.id));

        memories.remember();
        setEdges(eds => eds.filter(e => !idsToRemove.has(e.id)));
        toast.success(`Cut ${idsToRemove.size} wire(s)`);
        useAppStore.getState().triggerLogicUpdate();
    }, [setEdges, memories]);

    // --- Auto-Insert: Inject Node into Edge (Atomic Action) ---
    const injectNode = useCallback((node: Node, edgeToSplit: Edge, targetHandle: string) => {
        memories.remember();

        setEdges(eds => {
            const currentNodes = getNodes();
            const sourceNode = currentNodes.find(n => n.id === edgeToSplit.source);

            const newNodeInput = targetHandle;
            const newNodeOutput = 'output'; // Standard source handle for all nodes

            const newEdge1 = {
                id: nanoid(6),
                source: edgeToSplit.source,
                sourceHandle: edgeToSplit.sourceHandle,
                target: node.id,
                targetHandle: newNodeInput,
                type: 'customEdge'
            };

            const newEdge2 = {
                id: nanoid(6),
                source: node.id,
                sourceHandle: newNodeOutput,
                target: edgeToSplit.target,
                targetHandle: edgeToSplit.targetHandle,
                type: 'customEdge'
            };

            const isFormula1 = sourceNode?.type !== 'inputNode';
            const isFormula2 = node.type !== 'inputNode';

            const e1 = { ...newEdge1, data: { isFormula: isFormula1 } };
            const e2 = { ...newEdge2, data: { isFormula: isFormula2 } };

            return eds
                .filter(e => e.id !== edgeToSplit.id) // Remove split edge
                .filter(e => !(e.target === node.id && e.targetHandle === newNodeInput)) // Safety: Remove old inputs if exist
                .concat([e1, e2] as Edge[]);
        });

        useAppStore.getState().triggerLogicUpdate();
        toast.success('Auto-inserted node!');

    }, [getNodes, setEdges, memories]);

    const paste = useCallback((screenMousePos: { x: number; y: number }) => {
        if (!clipboard || clipboard.length === 0) return;

        const center = getBoundingBox(clipboard);
        const targetPos = screenToFlowPosition(screenMousePos);
        const newNodes = generateOffsetNodes(clipboard, targetPos, center);

        _spawnNodes(newNodes);

        toast.success(`Pasted ${newNodes.length} node(s)`);
        return newNodes;
    }, [clipboard, screenToFlowPosition, _spawnNodes]);

    // --- Duplication ---

    const duplicate = useCallback((screenMousePos: { x: number; y: number }) => {
        const selectedNodes = getSelectedNodes();
        if (selectedNodes.length === 0) return;

        const OFFSET = 40;
        const newNodes = selectedNodes.map(node => {
            return createNodeObject(node.type || 'default', {
                x: node.position.x + OFFSET,
                y: node.position.y + OFFSET
            }, node.data, true);
        });

        _spawnNodes(newNodes);

        // AUTO-START PLACING (Pass nodes directly to avoid stale store race condition)
        startPlacing(newNodes.map(n => n.id), screenMousePos, 'move', newNodes);

        toast.success(`Duplicated ${selectedNodes.length} node(s)`);
        return newNodes;
    }, [getSelectedNodes, _spawnNodes, startPlacing]);


    // --- Mute ---
    const toggleMute = useCallback(() => {
        const selected = getSelectedNodes();
        if (selected.length === 0) return;

        setNodes((nds) => nds.map(n => {
            if (n.selected) {
                // Toggle muted state
                const isMuted = n.data.muted;
                return {
                    ...n,
                    data: {
                        ...n.data,
                        muted: !isMuted
                    }
                };
            }
            return n;
        }));

        // Count how many are now muted vs unmuted for a smart toast?
        // Simpler: just "Toggled Mute"

        // Critical Fix: We must wait for React to flush the setNodes update before triggering logic.
        // Otherwise, Brain sees stale data (old muted state).
        setTimeout(() => {
            useAppStore.getState().triggerLogicUpdate();
        }, 0);

        toast.success(`Toggled mute on ${selected.length} node(s)`);
    }, [getSelectedNodes, setNodes]);

    // Expose "hands" object
    const hands = useMemo(() => ({
        grabAll,
        grab,
        grabScale: (pos: { x: number, y: number }) => grab(pos, 'scale'),
        grabRotate: (pos: { x: number, y: number }) => grab(pos, 'rotate'),
        discard,
        copy,
        cut, // Clipboard cut
        sever, // Knife cut (Atomic)
        injectNode, // Auto-insert (Atomic)
        paste,
        duplicate,
        toggleMute, // New capability
        deselectAll,
        createNode,
        startPlacing,
        commitPlacement,
        cancelPlacement,
        isPlacing: !!placingNodeIds
    }), [grabAll, grab, discard, copy, cut, paste, duplicate, toggleMute, deselectAll, createNode, startPlacing, commitPlacement, cancelPlacement, placingNodeIds]);

    return {
        hands
    };
};
