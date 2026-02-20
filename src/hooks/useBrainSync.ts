import { useEffect, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Brain } from '../engine/Brain';

/**
 * useBrainSync
 * 
 * "Shadow Mirror" Hook
 * Synchronizes the React Flow graph state (Nodes/Edges) to the Brain.
 * This ensures Brain always has an up-to-date topology model.
 */
export function useBrainSync(nodes: Node[], edges: Edge[]) {
    const prevNodesRef = useRef<Map<string, Node>>(new Map());
    const prevEdgesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const brain = Brain.getInstance();

        // Guard: Skip transaction recording during relink drag
        // The relink system removes edges from UI for visual feedback,
        // but the actual DISCONNECT+CONNECT should be atomic via useRelink's BATCH
        if (brain.isReconnecting) {
            prevNodesRef.current = new Map(nodes.map(n => [n.id, n]));
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
                            data: node.data || {},
                            position: node.position
                        }
                    });
                }
            } else {
                // Check for Data Updates (Excluding internally managed 'value')
                const { value: _v, ...currentData } = node.data || {};
                const { value: _pv, ...prevData } = prevNode.data || {};

                if (JSON.stringify(currentData) !== JSON.stringify(prevData)) {
                    syncTxs.push({
                        type: 'UPDATE_NODE_DATA',
                        payload: {
                            id: node.id,
                            data: currentData
                        }
                    });
                }
            }

            // Sync Position (Phase 1.4)
            if (node.position && (!prevNode || !prevNode.position || Math.abs(node.position.x - prevNode.position.x) > 0.1 || Math.abs(node.position.y - prevNode.position.y) > 0.1)) {
                // Determine old position. If none, assume 0,0 
                const oldPos = prevNode?.position || { x: 0, y: 0 };
                syncTxs.push({
                    type: 'MOVE_NODE',
                    payload: {
                        id: node.id,
                        position: node.position,
                        oldPosition: oldPos
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

        // Execute all accumulated changes securely inside a single batch
        if (syncTxs.length > 0) {
            brain.applyTransaction({ type: 'BATCH', payload: syncTxs });
        }

    }, [nodes, edges]);
}
