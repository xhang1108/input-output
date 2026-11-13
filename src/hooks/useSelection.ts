import { useCallback } from 'react';
import { useReactFlow, Node, Edge } from '@xyflow/react';
import { generateNodeId, generateEdgeId } from '../utils/idGenerator';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import { Transaction } from '../engine/types/engineTypes';
import { useHistoryStore } from '../store/useHistoryStore';
import { NODE_DEFINITIONS } from '@/types/nodeDefinitions';
import { HandleConfig } from '../types/nodeDefinitions';
import { indexNodes, toAbsolute, toParentLocal } from '../utils/coordinates';

/**
 * useSelection
 * Handles node selection, deletion, reset, bundle, detach, and swap.
 */
export function useSelection() {
    const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();
    const brain = useBrain();
    const pushHistory = useHistoryStore(s => s.push);
    const config = brain.getPhysicsConfig();

    // --- Command: Delete Selected ---
    const deleteSelected = useCallback(() => {
        const nodes = getNodes();
        const edges = getEdges();
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedIds = new Set(selectedNodes.map(n => n.id));

        if (selectedIds.size === 0) return;

        const nodeById = indexNodes(nodes);

        // Frame deletion is an unwrap, not a cascade: unselected direct children
        // become independent roots and keep their world position.
        const unwrapped: Array<{ child: Node; frameId: string }> = [];
        for (const frame of selectedNodes.filter(n => n.type === 'frame')) {
            for (const child of nodes.filter(n => n.parentId === frame.id && !selectedIds.has(n.id))) {
                unwrapped.push({ child, frameId: frame.id });
            }
        }

        const unwrapForward: Transaction[] = unwrapped.map(({ child }) => ({
            type: 'MOVE_NODE' as const,
            payload: {
                id: child.id,
                position: toAbsolute(nodeById, child.id),
                parentId: null,
            },
        }));

        const nodesToRemove = selectedNodes
            .slice()
            .sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0))
            .map(node => ({
                id: node.id,
                type: node.type,
                position: { ...node.position },
                data: { ...node.data },
                selected: node.selected,
                // Structure fidelity: without these, undo drops Frame parenting and sizes.
                parentId: node.parentId,
                width: node.width,
                height: node.height,
            }));

        const edgesToRemove = edges.filter(e => selectedIds.has(e.source) || selectedIds.has(e.target));

        const forward: Transaction[] = [
            ...unwrapForward,
            ...Array.from(selectedIds).map(id => ({ type: 'REMOVE_NODE' as const, payload: id }))
        ];

        const inverse: Transaction[] = [
            ...nodesToRemove.map(n => ({ type: 'ADD_NODE' as const, payload: { ...n, initialValue: n.data?.value } })),
            ...unwrapped.map(({ child, frameId }) => ({
                type: 'MOVE_NODE' as const,
                payload: {
                    id: child.id,
                    position: { ...child.position },
                    parentId: frameId,
                },
            })),
            ...edgesToRemove.map(e => ({ type: 'CONNECT' as const, payload: { ...e } }))
        ];

        const res = brain.applyTransaction({ type: 'BATCH', payload: forward });
        if (!res.success) return;

        pushHistory({
            id: `delete_${Date.now()}`,
            description: `Delete ${selectedIds.size} item(s)`,
            forward,
            inverse
        });
    }, [getNodes, getEdges, brain, pushHistory]);

    // --- Command: Reset Selected Data (Backspace) ---
    const resetSelected = useCallback(() => {
        const nodes = getNodes();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];

        selectedNodes.forEach(node => {
            const newLabel = 'Node';
            if (node.data?.label !== newLabel) {
                forward.push({ type: 'UPDATE_NODE_DATA', payload: { id: node.id, data: { label: newLabel } } });
                inverse.push({ type: 'UPDATE_NODE_DATA', payload: { id: node.id, data: { label: node.data?.label } } });
            }
        });

        if (forward.length > 0) {
            const res = brain.applyTransaction({ type: 'BATCH', payload: forward });
            if (!res.success) return;
            // Let useBrainUpdates handle UI sync

            pushHistory({
                id: `reset_${Date.now()}`,
                description: `Reset ${selectedNodes.length} node(s)`,
                forward,
                inverse
            });
        }
    }, [getNodes, brain, pushHistory]);



    // --- Command: Detach / Ungroup (Alt + G or Drag Out) ---
    // Note: 'detachSelected' mainly handled Edges in original code (Alt+Drag).
    // But logically "Ungroup" should be here too or separate.
    // The user's request implies "Drag out" is handled by useHand.
    // But "Shift+G" or "Alt+G" might be needed for in-place ungrouping.
    // For now, let's keep 'detachSelected' as Reference/Disconnect (original behavior)
    // AND add 'ungroupSelected' if needed? 
    // Wait, original 'detachSelected' was: "setEdges(eds => eds.filter...)" -> Disconnects edges.
    // Let's keep that as "Disconnect".
    const detachSelected = useCallback(() => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        const selectedIds = new Set(selected.map(n => n.id));

        // Disconnect Edges
        const edges = getEdges();
        const edgesToRemove = edges.filter(e => selectedIds.has(e.source) || selectedIds.has(e.target));

        if (edgesToRemove.length > 0) {
            const forward: Transaction[] = edgesToRemove.map(e => ({
                type: 'DISCONNECT',
                payload: e.id
            }));
            const inverse: Transaction[] = edgesToRemove.map(e => ({
                type: 'CONNECT',
                payload: { ...e }
            }));

            const res = brain.applyTransaction({ type: 'BATCH', payload: forward });
            if (!res.success) return;
            // Let useBrainUpdates handle UI sync to avoid duplicate key errors

            pushHistory({
                id: `detach_${Date.now()}`,
                description: `Detach ${edgesToRemove.length} edge(s)`,
                forward,
                inverse
            });
        }
    }, [getNodes, getEdges, brain, pushHistory]);

    // --- Command: Swap Inputs (Alt + S) ---
    const swapConnections = useCallback(() => {
        const nodes = getNodes();
        const edges = getEdges();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length !== 1) return;

        const node = selectedNodes[0];
        const targetId = node.id;

        // 1. Resolve handles
        const definition = NODE_DEFINITIONS.find(d => d.id === node.type);
        const allHandles = (node.data.handles as HandleConfig[]) || definition?.handles || [];
        const inputHandles = allHandles.filter(h => h.type === 'target');

        if (inputHandles.length < 2) return;

        const handleIds = inputHandles.map(h => h.id);
        const targetEdges = edges.filter(e => e.target === targetId && handleIds.includes(e.targetHandle || ''));

        if (targetEdges.length === 0) return;

        // 2. Build rotation mapping
        const rotationMap: Record<string, string> = {};
        handleIds.forEach((id, idx) => {
            const nextIdx = (idx + 1) % handleIds.length;
            rotationMap[id] = handleIds[nextIdx];
        });

        // 3. Generate transactions
        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];
        const newEdges: Edge[] = [];

        // Phase A: Disconnect everything
        targetEdges.forEach((edge) => {
            forward.push({ type: 'DISCONNECT', payload: edge.id });
            inverse.push({ type: 'CONNECT', payload: { ...edge } });
        });

        // Phase B: Connect everything to new targets
        targetEdges.forEach((edge) => {
            const currentHandleId = edge.targetHandle || '';
            const nextHandleId = rotationMap[currentHandleId];

            if (!nextHandleId) return;

            const newEdge: Edge = {
                ...edge,
                id: generateEdgeId(),
                targetHandle: nextHandleId
            };
            newEdges.push(newEdge);

            forward.push({ type: 'CONNECT', payload: newEdge });
            inverse.push({ type: 'DISCONNECT', payload: newEdge.id });
        });

        if (forward.length > 0) {
            const res = brain.applyTransaction({ type: 'BATCH', payload: forward });
            if (!res.success) return;
            // Let useBrainUpdates handle UI sync to avoid duplicate key errors

            pushHistory({
                id: `swap_${Date.now()}`,
                description: `Swap inputs on ${node.id}`,
                forward,
                inverse
            });
        }
    }, [getNodes, getEdges, brain, pushHistory]);

    const alignSelectedNodes = useCallback((axis: 'X' | 'Y') => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length < 2) return;

        const nodeById = indexNodes(nodes);

        // 1. Find the world-space minimum (the anchor). Raw `position` values are
        // only comparable when every node shares the same parent.
        const absoluteById = new Map(selected.map(node => [node.id, toAbsolute(nodeById, node.id)]));
        const minVal = Math.min(...selected.map(node => {
            const abs = absoluteById.get(node.id)!;
            return axis === 'X' ? abs.x : abs.y;
        }));

        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];

        // 2. Build Transitions (Strictly Red-Dot to Anchor)
        selected.forEach(node => {
            const abs = absoluteById.get(node.id)!;
            const targetAbsolute = {
                x: axis === 'X' ? minVal : abs.x,
                y: axis === 'Y' ? minVal : abs.y,
            };
            // Nodes may live under different parents, so the world-space target
            // must be converted back to the node's own parent-local position.
            const newPos = toParentLocal(nodeById, node.id, targetAbsolute);

            // Precision check against the stored parent-local position
            if (Math.abs(newPos.x - node.position.x) > 0.1 || Math.abs(newPos.y - node.position.y) > 0.1) {
                forward.push({ type: 'MOVE_NODE', payload: { id: node.id, position: newPos } });
                inverse.push({ type: 'MOVE_NODE', payload: { id: node.id, position: { ...node.position } } });
            }
        });

        if (forward.length > 0) {
            const res = brain.applyTransaction({ type: 'BATCH', payload: forward });
            if (!res.success) return;
            // Let useBrainUpdates handle UI sync to avoid duplicate key errors

            pushHistory({
                id: `align_${Date.now()}`,
                description: `Align ${axis === 'X' ? 'Left' : 'Top'} (${selected.length} nodes)`,
                forward,
                inverse
            });
        }
    }, [getNodes, brain, pushHistory]);

    // --- Selection Helpers ---
    const clearSelection = useCallback(() => {
        const nodes = getNodes();
        const txs: Transaction[] = nodes.filter(n => n.selected).map(n => ({
            type: 'UPDATE_NODE_DATA',
            payload: { id: n.id, data: { selected: false } }
        }));
        
        if (txs.length > 0) {
            brain.applyTransaction({ type: 'BATCH', payload: txs });
        }

        // Also clear UI edge selection
        setEdges(eds => eds.map(e => e.selected ? { ...e, selected: false } : e));
    }, [getNodes, brain, setEdges]);

    const selectNode = useCallback((id: string, exclusive: boolean = true) => {
        const nodes = getNodes();
        const txs: Transaction[] = [];

        if (exclusive) {
            // Robust Exclusivity: Check the Brain's state directly, as UI (getNodes) 
            // might be in the middle of a selection transition and show stale values.
            const brainNodes = brain.getNodesMap();
            for (const [nodeId, node] of brainNodes) {
                if (node.selected && nodeId !== id) {
                    txs.push({ type: 'UPDATE_NODE_DATA', payload: { id: nodeId, data: { selected: false } } });
                }
            }

            // Also clear UI edge selection
            setEdges(eds => eds.map(e => e.selected ? { ...e, selected: false } : e));
        }

        const targetNode = nodes.find(n => n.id === id);
        if (targetNode && !targetNode.selected) {
            txs.push({ type: 'UPDATE_NODE_DATA', payload: { id, data: { selected: true } } });
        }

        if (txs.length > 0) {
            // Use non-silent transaction to trigger graphChanged update for UI sync
            brain.applyTransaction({ type: 'BATCH', payload: txs });
        }
    }, [getNodes, brain, setEdges]);

    return {
        deleteSelected,
        resetSelected,

        detachSelected,
        swapConnections,
        alignSelectedNodes,
        clearSelection,
        selectNode,
    };
}

