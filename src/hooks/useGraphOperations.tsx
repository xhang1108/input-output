import { useCallback, useState } from 'react';
import { useReactFlow, type Node, type XYPosition, type Edge } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';

// Define the shape of our clipboard data
// using Node type directly to avoid compatibility issues

export const useGraphOperations = () => {
    const { getNodes, setNodes, setEdges, screenToFlowPosition, fitView } = useReactFlow();
    const [clipboard, setClipboard] = useState<Node[]>([]);

    // =========================================
    // Level 1: Atomic Actions (Pure-ish State Helpers)
    // =========================================

    // Atom: Return new nodes with all deselected
    const deselectAll = useCallback((nodes: Node[]): Node[] => {
        return nodes.map(n => ({ ...n, selected: false }));
    }, []);

    // Atom: Create a new node object
    const createNode = useCallback((
        type: string,
        position: XYPosition,
        data: Record<string, unknown>,
        selected: boolean = false
    ): Node => {
        return {
            id: nanoid(8),
            type,
            position,
            data: { ...data },
            selected,
            // Defaults handled by React Flow mostly, but good to be explicit if needed
        };
    }, []);

    // Atom: Select specific nodes by ID to true (helper for complex updates)
    // Note: Usually we map over all nodes to set selection.

    // Atom: Get currently selected nodes
    const getSelectedNodes = useCallback((): Node[] => {
        return getNodes().filter(n => n.selected);
    }, [getNodes]);


    // =========================================
    // Level 2: Compound Actions (Business Logic)
    // =========================================

    // --- Selection ---

    const handleSelectAll = useCallback(() => {
        setNodes(nds => nds.map(n => ({ ...n, selected: true })));
    }, [setNodes]);

    const handleFocusSelected = useCallback(() => {
        const selected = getSelectedNodes();
        if (selected.length > 0) {
            fitView({ nodes: selected, duration: 800, padding: 0.2 });
        }
    }, [getSelectedNodes, fitView]);

    // --- Deletion ---

    const handleDelete = useCallback(() => {
        const currentNodes = getNodes();
        const nodesToDelete = new Set(currentNodes.filter(n => n.selected).map(n => n.id));

        if (nodesToDelete.size === 0) return;

        // Remove Edges connected to deleted nodes
        setEdges(eds => eds.filter(e => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)));

        // Remove Nodes
        setNodes(currentNodes.filter(n => !nodesToDelete.has(n.id)));
    }, [getNodes, setNodes, setEdges]);


    // --- Clipboard: Copy / Cut / Paste ---

    const handleCopy = useCallback(() => {
        const selected = getSelectedNodes();
        if (selected.length > 0) {
            setClipboard(selected);
            toast.success(`Copied ${selected.length} node(s)`);
        }
    }, [getSelectedNodes]);

    const handleCut = useCallback(() => {
        const selected = getSelectedNodes();
        if (selected.length > 0) {
            setClipboard(selected);

            // Re-use atomic deletion logic (inline here for specific toast interaction or just call handleDelete?)
            // Let's implement manually to ensure atomicity and specific toast.
            const nodesToDelete = new Set(selected.map(n => n.id));
            setEdges(eds => eds.filter(e => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)));
            setNodes(nds => nds.filter(n => !nodesToDelete.has(n.id)));

            toast.success(`Cut ${selected.length} node(s)`);
        }
    }, [getSelectedNodes, setEdges, setNodes]);

    const handlePaste = useCallback((screenMousePos: { x: number; y: number }) => {
        if (!clipboard || clipboard.length === 0) return;

        const currentNodes = getNodes();

        // 1. Calculate Center of Clipboard Nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        clipboard.forEach(n => {
            const x = n.position.x;
            const y = n.position.y;
            const w = n.measured?.width ?? n.width ?? 200;
            const h = n.measured?.height ?? n.height ?? 50;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // 2. Calculate Target Position
        const mouseFlowPos = screenToFlowPosition(screenMousePos);
        const moveX = mouseFlowPos.x - centerX;
        const moveY = mouseFlowPos.y - centerY;

        // 3. Create New Nodes (Atom: createNode)
        const newNodes = clipboard.map(node => {
            const newPos = { x: node.position.x + moveX, y: node.position.y + moveY };
            return createNode(node.type || 'default', newPos, node.data, true);
        });

        // 4. Deselect Old (Atom: deselectAll)
        const oldNodesDeselected = deselectAll(currentNodes);

        // 5. Update State
        setNodes([...oldNodesDeselected, ...newNodes]);
        toast.success(`Pasted ${newNodes.length} node(s)`);

    }, [clipboard, getNodes, setNodes, screenToFlowPosition, deselectAll, createNode]);


    // --- Duplication ---

    const handleDuplicate = useCallback((screenMousePos: { x: number; y: number }) => {
        const selectedNodes = getSelectedNodes();
        if (selectedNodes.length === 0) return;

        const currentNodes = getNodes();

        // 1. Calculate Center
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        selectedNodes.forEach(n => {
            const x = n.position.x;
            const y = n.position.y;
            const w = n.measured?.width ?? n.width ?? 200;
            const h = n.measured?.height ?? n.height ?? 50;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // 2. Calculate Target Position (To Mouse)
        const mouseFlowPos = screenToFlowPosition(screenMousePos);
        const moveX = mouseFlowPos.x - centerX;
        const moveY = mouseFlowPos.y - centerY;

        // 3. Create New Nodes
        const newNodes = selectedNodes.map(node => {
            const newPos = { x: node.position.x + moveX, y: node.position.y + moveY };
            return createNode(node.type || 'default', newPos, node.data, true);
        });

        // 4. Update State (Deselect old, add new)
        const oldNodesDeselected = deselectAll(currentNodes);
        setNodes([...oldNodesDeselected, ...newNodes]);

        toast.success(`Duplicated ${selectedNodes.length} node(s)`);

    }, [getSelectedNodes, getNodes, screenToFlowPosition, createNode, deselectAll, setNodes]);


    return {
        // Atoms
        deselectAll,
        createNode,
        // Compounds
        handleSelectAll,
        handleFocusSelected,
        handleDelete,
        handleCopy,
        handleCut,
        handlePaste,
        handleDuplicate,
        // Grab logic might still need component-side state, 
        // but simple toggle could be here if we move placingNodeIds state here. 
        // For now, these are the "One-Shot" Actions.
    };
};
