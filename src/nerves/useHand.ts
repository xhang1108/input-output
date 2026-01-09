import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useReactFlow, useStoreApi, getSmoothStepPath, Position, type Node, type Edge, type XYPosition } from '@xyflow/react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import {
    createNodeObject,
    getBoundingBox,
    generateOffsetNodes,
    getConnectedEdgeIds
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
    const [placingNodeIds, setPlacingNodeIds] = useState<Set<string> | null>(null);
    const placementRef = useRef<{
        startMousePos: { x: number, y: number },
        nodeOffsets: Record<string, { x: number, y: number }>
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

    const startPlacing = useCallback((nodeIds: string[], initialMousePos: { x: number, y: number }, initialNodes?: Node[]) => {
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

        setPlacingNodeIds(new Set(nodeIds));
        placementRef.current = {
            startMousePos: initialMousePos,
            nodeOffsets: nodeOffsets
        };
    }, [getNodes, setNodes]);

    const commitPlacement = useCallback(() => {
        setPlacingNodeIds(null);
        placementRef.current = null;
    }, []);

    // --- Movement Effect (The "Hand" follows the "Cursor") ---
    useEffect(() => {
        if (!placingNodeIds) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!placementRef.current) return;

            const currentFlowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            const startFlowPos = screenToFlowPosition(placementRef.current.startMousePos);

            const dx = currentFlowPos.x - startFlowPos.x;
            const dy = currentFlowPos.y - startFlowPos.y;

            setNodes((nds) => nds.map(n => {
                if (placingNodeIds.has(n.id)) {
                    const originalPos = placementRef.current!.nodeOffsets[n.id];
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
        };

        const handleMouseDown = (e: MouseEvent) => {
            // Commit placement on click
            e.stopPropagation();
            commitPlacement();
        };

        window.addEventListener('mousemove', handleMouseMove);
        // Safety: Delay attaching mousedown to prevent instant drops if event is leaking
        // (e.g., if the user is still holding Shift+D)
        const timer = setTimeout(() => {
            window.addEventListener('mousedown', handleMouseDown, { capture: true });
        }, 300);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown, { capture: true });
            clearTimeout(timer);
        };
    }, [placingNodeIds, screenToFlowPosition, setNodes, commitPlacement]);

    // --- Selection ---

    const grabAll = useCallback(() => {
        setNodes(nds => nds.map(n => ({ ...n, selected: true })));
    }, [setNodes]);

    // Unified Grab Action (Tries selection first, then hover)
    const grab = useCallback((screenMousePos: { x: number, y: number }) => {
        const selected = getSelectedNodes();
        if (selected.length > 0) {
            startPlacing(selected.map(n => n.id), screenMousePos);
            toast.success('Grabbed');
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

                startPlacing([n.id], screenMousePos);
                toast.success('Grabbed');
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
            const newNodeOutput = null; // Default source handle for new node

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
        startPlacing(newNodes.map(n => n.id), screenMousePos, newNodes);

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
        isPlacing: !!placingNodeIds
    }), [grabAll, grab, discard, copy, cut, paste, duplicate, toggleMute, deselectAll, createNode, startPlacing, commitPlacement, placingNodeIds]);

    return {
        hands
    };
};
