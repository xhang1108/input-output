import { useCallback } from 'react';
import { useReactFlow, Node, Edge } from '@xyflow/react';
import { generateNodeId, generateEdgeId } from '../utils/idGenerator';

const CLIPBOARD_KEY = 'calctopus_clipboard';

/**
 * useClipboard
 * Handles clone, copy, paste, and duplicate operations on nodes and edges.
 */
export function useClipboard() {
    const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

    // --- Helper: Clone Nodes & Edges (Internal) ---
    const cloneElements = useCallback((nodesToClone: Node[], edgesToClone: Edge[], offset: { x: number, y: number } = { x: 0, y: 0 }) => {
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

        const newEdges = edgesToClone.map(edge => {
            const newSource = idMap.get(edge.source);
            const newTarget = idMap.get(edge.target);
            if (!newSource || !newTarget) return null;

            return {
                ...edge,
                id: generateEdgeId(),
                source: newSource,
                target: newTarget,
                selected: true
            };
        }).filter(Boolean) as Edge[];

        return { newNodes, newEdges };
    }, []);

    // --- Command: Duplicate (Immediate) ---
    const duplicateSelected = useCallback((): { nodes: Node[], edges: Edge[] } | false => {
        const nodes = getNodes();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return false;

        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const edgesToClone = getEdges().filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));

        const { newNodes, newEdges } = cloneElements(selectedNodes, edgesToClone, { x: 0, y: 0 });

        setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), ...newNodes]);
        setEdges(eds => [...eds.map(e => ({ ...e, selected: false })), ...newEdges]);
        return { nodes: newNodes, edges: newEdges };
    }, [getNodes, getEdges, setNodes, setEdges, cloneElements]);

    // --- Command: Copy to Clipboard ---
    const copyToClipboard = useCallback(() => {
        const nodes = getNodes();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const edgesToCopy = getEdges().filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));

        const payload = JSON.stringify({ nodes: selectedNodes, edges: edgesToCopy });
        localStorage.setItem(CLIPBOARD_KEY, payload);
    }, [getNodes, getEdges]);

    // --- Command: Paste from Clipboard ---
    const pasteFromClipboard = useCallback(() => {
        const payload = localStorage.getItem(CLIPBOARD_KEY);
        if (!payload) return;

        try {
            const parsed = JSON.parse(payload);

            if (!parsed || !Array.isArray(parsed.nodes)) {
                return;
            }

            const clipboardNodes: Node[] = parsed.nodes;
            const clipboardEdges: Edge[] = parsed.edges || [];

            const { newNodes, newEdges } = cloneElements(clipboardNodes, clipboardEdges, { x: 20, y: 20 });
            setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), ...newNodes]);
            setEdges(eds => [...eds.map(e => ({ ...e, selected: false })), ...newEdges]);
        } catch (e) {
            console.error("Failed to paste items", e);
        }
    }, [setNodes, setEdges, cloneElements]);

    return {
        duplicateSelected,
        copyToClipboard,
        pasteFromClipboard,
    };
}
