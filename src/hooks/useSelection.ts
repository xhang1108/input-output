import { useCallback } from 'react';
import { useReactFlow, Node, Edge } from '@xyflow/react';
import { generateNodeId, generateEdgeId } from '../utils/idGenerator';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import { Transaction } from '../engine/types/engineTypes';
import { useHistoryStore } from '../store/useHistoryStore';
import { NODE_DEFINITIONS } from '@/types/nodeDefinitions';
import { HandleConfig } from '../types/nodeDefinitions';

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

        const nodesToRemove = selectedNodes.map(node => ({
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
            ...Array.from(selectedIds).map(id => ({ type: 'REMOVE_NODE' as const, payload: id }))
        ];

        const inverse: Transaction[] = [
            ...nodesToRemove.map(n => ({ type: 'ADD_NODE' as const, payload: { ...n, initialValue: n.data?.value } })),
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

        // 1. Find the Absolute Minimum (The Anchor)
        const positions = selected.map(n => n.position);
        const minVal = Math.min(...positions.map(p => axis === 'X' ? p.x : p.y));

        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];

        // 2. Build Transitions (Strictly Red-Dot to Anchor)
        selected.forEach(node => {
            const newPos = {
                x: axis === 'X' ? minVal : node.position.x,
                y: axis === 'Y' ? minVal : node.position.y
            };

            // Precision check
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

