import { useCallback } from 'react';
import { useReactFlow, Node } from '@xyflow/react';
import { generateNodeId } from '../utils/idGenerator';

const CLIPBOARD_KEY = 'calctopus_clipboard';

/**
 * useClipboard
 * Handles clone, copy, paste, and duplicate operations on nodes.
 */
export function useClipboard() {
    const { getNodes, setNodes } = useReactFlow();

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

        const newNodes = cloneNodes(selectedNodes, { x: 0, y: 0 });
        setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
        return newNodes;
    }, [getNodes, setNodes, cloneNodes]);

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

    return {
        duplicateSelected,
        copyToClipboard,
        pasteFromClipboard,
    };
}
