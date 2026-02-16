import { useCallback } from 'react';
import { useReactFlow, Node } from '@xyflow/react';
import { generateNodeId } from '../utils/idGenerator';
import { Brain } from '../engine/Brain';
import { Transaction } from '../engine/types';

/**
 * useSelection
 * Handles node selection, deletion, reset, grouping, detach, and swap.
 */
export function useSelection() {
    const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

    // --- Command: Delete Selected ---
    const deleteSelected = useCallback(() => {
        const nodes = getNodes();
        const selectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));

        if (selectedNodeIds.size === 0) return;

        setNodes(nds => nds.filter(n => !selectedNodeIds.has(n.id)));
        setEdges(eds => eds.filter(e => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
    }, [getNodes, setNodes, setEdges]);

    // --- Command: Reset Selected Data (Backspace) ---
    const resetSelected = useCallback(() => {
        setNodes(nds => nds.map(n => {
            if (!n.selected) return n;
            return {
                ...n,
                data: {
                    ...n.data,
                    label: n.type === 'frame' ? 'Group' : 'Node'
                }
            };
        }));
    }, [setNodes]);

    // --- Command: Group Nodes (Frames) ---
    const groupSelected = useCallback(() => {
        const nodes = getNodes();
        const selectedNodes = nodes.filter(n => n.selected && n.type !== 'frame' && !n.parentId);

        if (selectedNodes.length === 0) return;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        selectedNodes.forEach(node => {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            const w = node.measured?.width ?? 150;
            const h = node.measured?.height ?? 50;
            maxX = Math.max(maxX, node.position.x + w);
            maxY = Math.max(maxY, node.position.y + h);
        });

        const PADDING = 50;
        minX -= PADDING;
        minY -= PADDING + 30;
        maxX += PADDING;
        maxY += PADDING;

        const width = maxX - minX;
        const height = maxY - minY;

        const frameId = generateNodeId('frame');
        const frameNode: Node = {
            id: frameId,
            type: 'frame',
            position: { x: minX, y: minY },
            data: { label: 'Group', width, height },
            style: { width, height, zIndex: -100 },
            selected: true,
        };

        const updatedChildren = selectedNodes.map(node => ({
            ...node,
            selected: false,
            parentId: frameId,
            extent: 'parent' as const,
            position: {
                x: node.position.x - minX,
                y: node.position.y - minY,
            },
            style: { ...node.style, zIndex: 100 }
        }));

        setNodes(nds => {
            const others = nds.filter(n => !selectedNodes.find(sn => sn.id === n.id));
            return [...others, frameNode, ...updatedChildren];
        });

    }, [getNodes, setNodes]);

    // --- Command: Detach (Alt + Drag) ---
    const detachSelected = useCallback(() => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 0) return;

        const selectedIds = new Set(selected.map(n => n.id));
        setEdges(eds => eds.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
    }, [getNodes, setEdges]);

    // --- Command: Swap Inputs (Alt + S) ---
    const swapConnections = useCallback(() => {
        const selectedNodes = getNodes().filter(n => n.selected);
        if (selectedNodes.length !== 1) return;

        const targetId = selectedNodes[0].id;
        const edges = getEdges();

        const edgeA = edges.find(e => e.target === targetId && e.targetHandle === 'in_a');
        const edgeB = edges.find(e => e.target === targetId && e.targetHandle === 'in_b');

        if (edgeA && edgeB) {
            const txs: Transaction[] = [
                { type: 'DISCONNECT', payload: edgeA.id },
                { type: 'DISCONNECT', payload: edgeB.id },
                {
                    type: 'CONNECT',
                    payload: { ...edgeA, id: `edge-${Date.now()}-a`, source: edgeB.source, sourceHandle: edgeB.sourceHandle }
                },
                {
                    type: 'CONNECT',
                    payload: { ...edgeB, id: `edge-${Date.now()}-b`, source: edgeA.source, sourceHandle: edgeA.sourceHandle }
                }
            ];
            Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });

        } else if (edgeA && !edgeB) {
            const txs: Transaction[] = [
                { type: 'DISCONNECT', payload: edgeA.id },
                {
                    type: 'CONNECT',
                    payload: { ...edgeA, id: `edge-${Date.now()}-mov`, targetHandle: 'in_b' }
                }
            ];
            Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });

        } else if (!edgeA && edgeB) {
            const txs: Transaction[] = [
                { type: 'DISCONNECT', payload: edgeB.id },
                {
                    type: 'CONNECT',
                    payload: { ...edgeB, id: `edge-${Date.now()}-mov`, targetHandle: 'in_a' }
                }
            ];
            Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });
        }

    }, [getNodes, getEdges]);

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
        groupSelected,
        detachSelected,
        swapConnections,
        clearSelection,
        selectNode,
    };
}
