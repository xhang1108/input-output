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
    const prevNodesRef = useRef<Set<string>>(new Set());
    const prevEdgesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const brain = Brain.getInstance();

        // Guard: Skip transaction recording during relink drag
        // The relink system removes edges from UI for visual feedback,
        // but the actual DISCONNECT+CONNECT should be atomic via useRelink's BATCH
        if (brain.isReconnecting) {
            prevNodesRef.current = new Set(nodes.map(n => n.id));
            prevEdgesRef.current = new Set(edges.map(e => e.id));
            return;
        }

        // --- Sync Nodes ---
        const currentNodes = new Set(nodes.map(n => n.id));

        // 1. Additions
        nodes.forEach(node => {
            if (!prevNodesRef.current.has(node.id)) {
                // Guard: Skip if Brain already has this node (e.g. from Undo)
                const existing = brain.getNode(node.id);
                if (!existing) {
                    brain.applyTransaction({
                        type: 'ADD_NODE',
                        payload: {
                            id: node.id,
                            initialValue: node.data?.value || 0,
                            type: node.type,
                            data: node.data || {},
                            position: node.position
                        }
                    });
                }
            }
        });

        // 2. Removals
        prevNodesRef.current.forEach(id => {
            if (!currentNodes.has(id)) {
                // Guard: Skip if Brain already removed this node (e.g. from Undo)
                const existing = brain.getNode(id);
                if (existing) {
                    brain.applyTransaction({
                        type: 'REMOVE_NODE',
                        payload: id
                    });
                }
            }
        });

        prevNodesRef.current = currentNodes;

        // --- Sync Edges ---
        const currentEdges = new Set(edges.map(e => e.id));

        // 3. New Connections
        edges.forEach(edge => {
            if (!prevEdgesRef.current.has(edge.id)) {
                // Check if Brain already has this edge (to avoid duplicate logs/logic if we double-sync)
                const existing = brain.getEdges().find(e => e.id === edge.id);
                if (!existing) {
                    brain.applyTransaction({
                        type: 'CONNECT',
                        payload: edge
                    });
                }
            }
        });

        // 4. Disconnections
        prevEdgesRef.current.forEach(id => {
            if (!currentEdges.has(id)) {
                // Guard: Skip if Brain already removed this edge (e.g. from Undo)
                const existing = brain.getEdges().find(e => e.id === id);
                if (existing) {
                    brain.applyTransaction({
                        type: 'DISCONNECT',
                        payload: id
                    });
                }
            }
        });

        prevEdgesRef.current = currentEdges;

    }, [nodes, edges]);
}
