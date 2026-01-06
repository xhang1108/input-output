import { useCallback, useState, useMemo } from 'react';
import { useReactFlow, useStoreApi, type Node, type Edge, type XYPosition } from '@xyflow/react';
import { toast } from 'sonner';
import {
    createNodeObject,
    getBoundingBox,
    generateOffsetNodes,
    getConnectedEdgeIds
} from '../utils/graphPhysics';

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
    // We can only use addNodes if we are using internal store, or we have to manually implement it for external
    // Since Calctopus uses external state (Body -> useNodesState), we should stick to setNodes but maybe use functional update correctly.
    const setEdges = setEdgesExternal || setEdgesInternal;

    const [clipboard, setClipboard] = useState<Node[]>([]);

    // =========================================
    // Level 1: Atomic Actions (Pure-ish State Helpers)
    // =========================================

    const deselectAll = useCallback((nodes: Node[]): Node[] => {
        return nodes.map(n => ({ ...n, selected: false }));
    }, []);

    const getSelectedNodes = useCallback((): Node[] => {
        return getNodes().filter(n => n.selected);
    }, [getNodes]);

    // Wrapper for consumers who might use hands.createNode (keeping API surface if needed)
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
        // This is the programmatic fix for the "Box Select Taint"
        store.setState({ nodesSelectionActive: false });

        // 2. Snapshot for Undo
        memories.remember();

        // 2. Add new nodes (selected by default for standard UX)
        // CSS fix handles the Box Selection wrapper issue
        setNodes((currentNodes) => {
            const deselected = currentNodes.map(n => ({ ...n, selected: false }));
            return [...deselected, ...newNodes.map(n => ({ ...n, selected: true }))];
        });

        return newNodes.map(n => n.id);
    }, [setNodes, memories]);


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

        // 4. Snapshot (Future)
        // takeSnapshot();

    }, [getNodes, getEdges, setNodes, setEdges]);

    // =========================================
    // Level 3: Compound Actions (Public API)
    // =========================================

    // --- Selection ---

    const grabAll = useCallback(() => {
        setNodes(nds => nds.map(n => ({ ...n, selected: true })));
    }, [setNodes]);



    // --- Deletion ---

    // Exposed as 'discard' to maintain compatibility, maps to 'delete' logic
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
            // Sanitize: Only copy essential data
            // structuredClone fails on BigNumber (complex objects), so we use JSON serialization which is safer for clipboard
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

    const paste = useCallback((screenMousePos: { x: number; y: number }) => {
        if (!clipboard || clipboard.length === 0) return;

        // 1. Physics: Calculate Center (of Clipboard)
        const center = getBoundingBox(clipboard);

        // 2. Physics: Target Position (Mouse)
        const targetPos = screenToFlowPosition(screenMousePos);

        // 3. Physics: Generate Nodes
        const newNodes = generateOffsetNodes(clipboard, targetPos, center);

        // 4. State: Spawn
        _spawnNodes(newNodes);

        toast.success(`Pasted ${newNodes.length} node(s)`);

        // Return the actual node objects so the caller can handle them immediately (interaction)
        return newNodes;

    }, [clipboard, screenToFlowPosition, _spawnNodes]);


    // --- Duplication ---

    const duplicate = useCallback((screenMousePos: { x: number; y: number }) => {
        const selectedNodes = getSelectedNodes();
        if (selectedNodes.length === 0) return;

        // 1. Physics: Calculate Center (of Selection)
        const center = getBoundingBox(selectedNodes);

        // 2. Physics: Target Position (Mouse)
        const targetPos = screenToFlowPosition(screenMousePos);

        // 3. Physics: Generate Nodes
        const newNodes = generateOffsetNodes(selectedNodes, targetPos, center);

        // 4. State: Spawn
        _spawnNodes(newNodes);

        toast.success(`Duplicated ${selectedNodes.length} node(s)`);

        return newNodes;

    }, [getSelectedNodes, screenToFlowPosition, _spawnNodes]);


    // Expose "hands" object
    // Memoize this to prevent useEar from re-binding listeners constantly
    const hands = useMemo(() => ({
        grabAll,
        discard,
        copy,
        cut,
        paste,
        duplicate,
        deselectAll,
        createNode
    }), [grabAll, discard, copy, cut, paste, duplicate, deselectAll, createNode]);

    return {
        hands
    };
};
