import { useCallback } from 'react';
import { useReactFlow, Node, Edge } from '@xyflow/react';
import { generateNodeId, generateEdgeId } from '../utils/idGenerator';
import { useBrain } from '../context/BrainContext';
import { useHistoryStore } from '../store/useHistoryStore';
import { Transaction } from '../engine/types/engineTypes';

const CLIPBOARD_KEY = 'Input-Output_clipboard';

/**
 * useClipboard
 * Handles clone, copy, paste, and duplicate operations on nodes and edges.
 */
export function useClipboard() {
    const { getNodes, setNodes, getEdges, setEdges: rfSetEdges } = useReactFlow();
    const brain = useBrain();
    const pushHistory = useHistoryStore(s => s.push);

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

        const { newNodes, newEdges } = cloneElements(selectedNodes, edgesToClone, { x: 20, y: 20 });

        const deselectTxs: Transaction[] = selectedNodes.map(n => ({
            type: 'UPDATE_NODE_DATA',
            payload: { id: n.id, data: { selected: false } }
        } as Transaction));

        const forwardTxs: Transaction[] = [
            ...deselectTxs,
            ...newNodes.map((n: Node) => ({ type: 'ADD_NODE', payload: n } as Transaction)),
            ...newEdges.map((e: Edge) => ({ type: 'CONNECT', payload: e } as Transaction))
        ];

        const inverseTxs: Transaction[] = [
            ...newEdges.map((e: Edge) => ({ type: 'DISCONNECT', payload: e.id } as Transaction)),
            ...newNodes.map((n: Node) => ({ type: 'REMOVE_NODE', payload: n.id } as Transaction)),
            ...selectedNodes.map(n => ({ type: 'UPDATE_NODE_DATA', payload: { id: n.id, data: { selected: true } } } as Transaction))
        ];

        brain.applyTransaction({ type: 'BATCH', payload: forwardTxs });
        
        pushHistory({
            id: `duplicate_${Date.now()}`,
            description: `Duplicate ${newNodes.length} nodes`,
            forward: forwardTxs,
            inverse: inverseTxs
        });

        return { nodes: newNodes, edges: newEdges };
    }, [getNodes, getEdges, rfSetEdges, cloneElements, brain, pushHistory]);

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
    const pasteFromClipboard = useCallback((targetPos?: { x: number, y: number }) => {
        const payload = localStorage.getItem(CLIPBOARD_KEY);
        if (!payload) return;

        try {
            const parsed = JSON.parse(payload);

            if (!parsed || !Array.isArray(parsed.nodes)) {
                return;
            }

            const clipboardNodes: Node[] = parsed.nodes;
            const clipboardEdges: Edge[] = parsed.edges || [];

            let offset = { x: 20, y: 20 };

            if (targetPos && clipboardNodes.length > 0) {
                let minX = Infinity, minY = Infinity;
                clipboardNodes.forEach(n => {
                    minX = Math.min(minX, n.position.x);
                    minY = Math.min(minY, n.position.y);
                });

                offset = {
                    x: targetPos.x - minX,
                    y: targetPos.y - minY
                };
            }

            const selectedNodes = getNodes().filter(n => n.selected);
            const deselectTxs: Transaction[] = selectedNodes.map(n => ({
                type: 'UPDATE_NODE_DATA',
                payload: { id: n.id, data: { selected: false } }
            } as Transaction));

            const { newNodes, newEdges } = cloneElements(clipboardNodes, clipboardEdges, offset);

            const forwardTxs: Transaction[] = [
                ...deselectTxs,
                ...newNodes.map((n: Node) => ({ type: 'ADD_NODE', payload: n } as Transaction)),
                ...newEdges.map((e: Edge) => ({ type: 'CONNECT', payload: e } as Transaction))
            ];

            const inverseTxs: Transaction[] = [
                ...newEdges.map((e: Edge) => ({ type: 'DISCONNECT', payload: e.id } as Transaction)),
                ...newNodes.map((n: Node) => ({ type: 'REMOVE_NODE', payload: n.id } as Transaction)),
                ...selectedNodes.map(n => ({ type: 'UPDATE_NODE_DATA', payload: { id: n.id, data: { selected: true } } } as Transaction))
            ];

            brain.applyTransaction({ type: 'BATCH', payload: forwardTxs });
            
            pushHistory({
                id: `paste_${Date.now()}`,
                description: `Paste ${newNodes.length} nodes`,
                forward: forwardTxs,
                inverse: inverseTxs
            });

        } catch (e) {
            console.error("Failed to paste items", e);
        }
    }, [getNodes, rfSetEdges, cloneElements, brain, pushHistory]);

    return {
        duplicateSelected,
        copyToClipboard,
        pasteFromClipboard,
    };
}


