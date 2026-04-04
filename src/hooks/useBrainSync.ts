import { useEffect, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import { useHistoryStore } from '../store/useHistoryStore';
import deepEqual from 'fast-deep-equal';

/**
 * useBrainSync
 * 
 * "Shadow Mirror" Hook
 * Synchronizes the React Flow graph state (Nodes/Edges) to the Brain.
 * This ensures Brain always has an up-to-date topology model.
 */
export function useBrainSync(nodes: Node[], edges: Edge[]) {
    const brain = useBrain();
    const isRestoring = useHistoryStore(s => s.isRestoring);
    const prevNodesRef = useRef<Map<string, Node>>(new Map());
    const prevEdgesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Guard 1: Skip if we are currently restoring from history
        if (isRestoring) {
            prevNodesRef.current = new Map(nodes.map(n => [n.id, { ...n }]));
            prevEdgesRef.current = new Set(edges.map(e => e.id));
            return;
        }

        // Guard 2: Skip transaction recording during relink drag
        // The relink system removes edges from UI for visual feedback,
        // but the actual DISCONNECT+CONNECT should be atomic via useRelink's BATCH
        if (brain.isReconnecting) {
            prevNodesRef.current = new Map(nodes.map(n => [n.id, { ...n }]));
            prevEdgesRef.current = new Set(edges.map(e => e.id));
            return;
        }


        // Fix: HMR Safety - ensure prevNodesRef is a Map
        if (!(prevNodesRef.current instanceof Map)) {
            prevNodesRef.current = new Map();
        }

        const syncTxs: import('../engine/types').Transaction[] = [];

        // --- Sync Nodes ---
        const currentNodesMap = new Map(nodes.map(n => [n.id, n]));

        // 1. Additions & Updates
        nodes.forEach(node => {
            const prevNode = prevNodesRef.current.get(node.id);

            // TRANSIENT STATE ISOLATION: 
            // Keys that strictly belong to UI-only logic and should NEVER enter the Brain/MathEngine.
            // This prevents "Focus Stealing" where a stale engine state (isEditing: true) 
            // overwrites the newer UI state (isEditing: false) on a different node's update.
            const TRANSIENT_KEYS = ['isEditing', 'isTyping', 'isPending'];
            const filterTransient = (obj: any) => {
                if (!obj) return {};
                const res = { ...obj };
                TRANSIENT_KEYS.forEach(k => delete res[k]);
                return res;
            };

            if (!prevNode) {
                // New Node
                const existing = brain.getNode(node.id);
                if (!existing) {
                    syncTxs.push({
                        type: 'ADD_NODE',
                        payload: {
                            id: node.id,
                            initialValue: node.data?.value,
                            type: node.type,
                            data: filterTransient(node.data),
                            position: node.position,
                            selected: node.selected || false
                        }
                    });
                }
            } else {
                // If an active resize is in progress, skip ALL data/position diffs —
                // only the onResizeEnd's atomic BATCH should be recorded.
                // We still update prevRef below so the diff resolves cleanly after resize.
                if (!brain.isResizing) {
                    // Check for Selection Changes
                    if (node.selected !== prevNode.selected) {
                        // Use silent mode for selection updates to avoid triggering BATCH re-evaluations
                        brain.applyTransaction({
                            type: 'UPDATE_NODE_DATA',
                            payload: {
                                id: node.id,
                                data: { selected: node.selected }
                            }
                        }, true);
                    }

                    // Check for Data Updates (Excluding internally managed 'value' and transient UI flags)
                    const currentDataFiltered = filterTransient(node.data);
                    const prevDataFiltered = filterTransient(prevNode.data);

                    // Skip the 'value' key from common data sync as it's managed via UPDATE_VALUE
                    delete (currentDataFiltered as any).value;
                    delete (prevDataFiltered as any).value;

                    if (!deepEqual(currentDataFiltered, prevDataFiltered)) {
                        syncTxs.push({
                            type: 'UPDATE_NODE_DATA',
                            payload: {
                                id: node.id,
                                data: currentDataFiltered
                            }
                        });
                    }
                }
            }

            // Sync Position (Phase 1.4)
            if (node.position && (!prevNode || !prevNode.position || Math.abs(node.position.x - prevNode.position.x) > 0.5 || Math.abs(node.position.y - prevNode.position.y) > 0.5)) {
                syncTxs.push({
                    type: 'MOVE_NODE',
                    payload: {
                        id: node.id,
                        position: node.position
                    }
                });
            }
        });

        // 2. Removals
        prevNodesRef.current.forEach((prevNode, id) => {
            if (!currentNodesMap.has(id)) {
                // Guard: Skip if Brain already removed this node (e.g. from Undo)
                const existing = brain.getNode(id);
                if (existing) {
                    syncTxs.push({
                        type: 'REMOVE_NODE',
                        payload: id
                    });
                }
            }
        });

        prevNodesRef.current = currentNodesMap;

        // --- Sync Edges ---
        const currentEdges = new Set(edges.map(e => e.id));

        // 3. Disconnections (Must happen BEFORE connections to free up slots)
        prevEdgesRef.current.forEach(id => {
            if (!currentEdges.has(id)) {
                // Guard: Skip if Brain already removed this edge (e.g. from Undo)
                const existing = brain.getEdges().find(e => e.id === id);
                if (existing) {
                    syncTxs.push({
                        type: 'DISCONNECT',
                        payload: id
                    });
                }
            }
        });

        // 4. New Connections
        edges.forEach(edge => {
            if (!prevEdgesRef.current.has(edge.id)) {
                // Check if Brain already has this edge (to avoid duplicate logs/logic if we double-sync)
                const existing = brain.getEdges().find(e => e.id === edge.id);
                if (!existing) {
                    syncTxs.push({
                        type: 'CONNECT',
                        payload: edge
                    });
                }
            }
        });

        prevEdgesRef.current = currentEdges;

        // Separate position-only MOVE_NODE from structural transactions.
        // MOVE_NODE during drag generates high frequency, low-value updates.
        // Sending them individually avoids triggering BATCH→syncWorker overhead.
        if (syncTxs.length > 0) {
            const moveTxs = syncTxs.filter(t => t.type === 'MOVE_NODE');
            const otherTxs = syncTxs.filter(t => t.type !== 'MOVE_NODE');

            // Apply MOVE_NODE individually (no history — useHand's confirmGrab commits final position)
            for (const tx of moveTxs) {
                brain.applyTransaction(tx, false);
            }

            // Apply remaining structural changes as a BATCH
            if (otherTxs.length > 0) {
                // Determine if this batch contains purely non-structural data updates
                const isPassiveBatch = otherTxs.every(t => t.type === 'UPDATE_NODE_DATA');
                brain.applyTransaction({ type: 'BATCH', payload: otherTxs }, isPassiveBatch);
            }
        }

    }, [nodes, edges]);
}

