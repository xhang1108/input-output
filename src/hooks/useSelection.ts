import { useCallback } from 'react';
import { useReactFlow, Node, Edge } from '@xyflow/react';
import { generateNodeId, generateEdgeId } from '../utils/idGenerator';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import { Transaction } from '../engine/types';
import { useHistoryStore } from '../store/useHistoryStore';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';
import { HandleConfig } from '../types/NodeDefinition';

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

        // Capture History
        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];
        const nodeIndices: Record<string, number> = {};

        // 1. Process Nodes
        selectedNodes.forEach(node => {
            const index = nodes.indexOf(node);
            nodeIndices[node.id] = index;

            forward.push({ type: 'REMOVE_NODE', payload: node.id });
            inverse.push({
                type: 'ADD_NODE',
                payload: {
                    id: node.id,
                    type: node.type,
                    position: { ...node.position },
                    data: { ...node.data },
                    selected: node.selected
                }
            });
        });

        // 2. Process Edges
        const edgesToRemove = edges.filter(e => selectedIds.has(e.source) || selectedIds.has(e.target));
        edgesToRemove.forEach(edge => {
            forward.push({ type: 'DISCONNECT', payload: edge.id });
            inverse.push({
                type: 'CONNECT',
                payload: { ...edge }
            });
        });

        // 3. Dispatch to Brain and UI
        brain.applyTransaction({ type: 'BATCH', payload: forward });
        setNodes(nds => nds.filter(n => !selectedIds.has(n.id)));
        setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));

        // 4. Push to History
        pushHistory({
            id: `delete_${Date.now()}`,
            description: `Delete ${selectedIds.size} items`,
            forward,
            inverse,
            uiMetadata: {
                restoredNodeIndices: nodeIndices
            }
        });
    }, [getNodes, getEdges, setNodes, setEdges, brain, pushHistory]);

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
            brain.applyTransaction({ type: 'BATCH', payload: forward });
            setNodes(nds => nds.map(n => {
                if (!n.selected) return n;
                return { ...n, data: { ...n.data, label: 'Node' } };
            }));

            pushHistory({
                id: `reset_${Date.now()}`,
                description: `Reset ${selectedNodes.length} nodes`,
                forward,
                inverse
            });
        }
    }, [getNodes, setNodes, brain, pushHistory]);



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
            const txs: Transaction[] = edgesToRemove.map(e => ({
                type: 'DISCONNECT',
                payload: e.id
            }));
            brain.applyTransaction({ type: 'BATCH', payload: txs });
        }
    }, [getNodes, getEdges]);

    // --- Command: Swap Inputs (Alt + S) ---
    const swapConnections = useCallback(() => {
        const nodes = getNodes();
        const edges = getEdges();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length !== 1) return;

        const node = selectedNodes[0];
        const targetId = node.id;

        // 1. Resolve handles (from data or definition)
        const definition = NODE_DEFINITIONS.find(d => d.id === node.type);
        const allHandles = (node.data.handles as HandleConfig[]) || definition?.handles || [];
        const inputHandles = allHandles.filter(h => h.type === 'target');

        if (inputHandles.length < 2) return;

        const handleIds = inputHandles.map(h => h.id);
        const targetEdges = edges.filter(e => e.target === targetId && handleIds.includes(e.targetHandle || ''));

        if (targetEdges.length === 0) return;

        // 2. Build rotation mapping: Map current handle ID to next handle ID
        const rotationMap: Record<string, string> = {};
        handleIds.forEach((id, idx) => {
            const nextIdx = (idx + 1) % handleIds.length;
            rotationMap[id] = handleIds[nextIdx];
        });

        // 3. Generate transactions
        const txs: Transaction[] = [];

        // TO PREVENT COLLISIONS: We MUST DISCONNECT ALL first, THEN CONNECT ALL.
        // In Brain.ts, applyTransaction('CONNECT') validates against occupied handles.
        // If we connect to handle B before disconnecting the edge currently at B, the operation fails.

        // Phase A: Disconnect everything
        targetEdges.forEach((edge) => {
            txs.push({ type: 'DISCONNECT', payload: edge.id });
        });

        // Phase B: Connect everything to new targets
        targetEdges.forEach((edge) => {
            const currentHandleId = edge.targetHandle || '';
            const nextHandleId = rotationMap[currentHandleId];

            if (!nextHandleId) return;

            txs.push({
                type: 'CONNECT',
                payload: {
                    ...edge,
                    id: generateEdgeId(),
                    targetHandle: nextHandleId
                }
            });
        });

        if (txs.length > 0) {
            brain.applyTransaction({ type: 'BATCH', payload: txs });
        }
    }, [getNodes, getEdges]);

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
            brain.applyTransaction({ type: 'BATCH', payload: forward });
            
            // Sync UI
            setNodes(nds => nds.map(n => {
                const tx = forward.find(f => (f.payload as { id: string }).id === n.id);
                return tx ? { ...n, position: (tx.payload as { position: { x: number, y: number } }).position } : n;
            }));

            pushHistory({
                id: `align_${Date.now()}`,
                description: `Align ${axis === 'X' ? 'Left' : 'Top'} (${selected.length} nodes)`,
                forward,
                inverse
            });
        }
    }, [getNodes, setNodes, brain, pushHistory]);

    // --- Selection Helpers ---
    const clearSelection = useCallback(() => {
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
    }, [setNodes]);

    const selectNode = useCallback((id: string, exclusive: boolean = true) => {
        setNodes(nds => {
            const targetNode = nds.find(n => n.id === id);
            if (!targetNode) return nds;

            const currentlySelectedIds = new Set(nds.filter(n => n.selected).map(n => n.id));
            const newSelectedIds = new Set(exclusive ? [id] : [...currentlySelectedIds, id]);

            const unselected = nds.filter(n => !newSelectedIds.has(n.id)).map(n => ({ ...n, selected: false }));
            const selected = nds.filter(n => newSelectedIds.has(n.id)).map(n => ({ ...n, selected: true }));

            const selectedOthers = selected.filter(n => n.id !== id);
            const target = selected.find(n => n.id === id)!;

            return [...unselected, ...selectedOthers, target];
        });
    }, [setNodes]);

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
