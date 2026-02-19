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

    // --- Command: Group / Ungroup Toggle (F key) ---
    const groupSelected = useCallback(() => {
        const nodes = getNodes();
        const selectedNonFrame = nodes.filter(n => n.selected && n.type !== 'frame');
        if (selectedNonFrame.length === 0) return;

        // Check if any selected nodes are already parented → Ungroup
        const parentedNodes = selectedNonFrame.filter(n => n.parentId);
        if (parentedNodes.length > 0) {
            // --- UNGROUP: detach from frame ---
            const txs: Transaction[] = [];
            const affectedFrameIds = new Set<string>();

            parentedNodes.forEach(node => {
                // Find parent frame to convert relative → absolute position
                const parentFrame = nodes.find(n => n.id === node.parentId);
                const absX = (parentFrame?.position.x ?? 0) + node.position.x;
                const absY = (parentFrame?.position.y ?? 0) + node.position.y;

                if (node.parentId) affectedFrameIds.add(node.parentId);

                // Clear parentId
                txs.push({
                    type: 'UPDATE_NODE_DATA',
                    payload: { id: node.id, data: { parentId: null } }
                });
                // Move to absolute position
                txs.push({
                    type: 'MOVE_NODE',
                    payload: {
                        id: node.id,
                        position: { x: absX, y: absY },
                        oldPosition: { ...node.position }
                    }
                });
            });

            // 5. Update frames: Resize or Delete
            affectedFrameIds.forEach(frameId => {
                const parentFrame = nodes.find(n => n.id === frameId);
                if (!parentFrame) return;

                const remainingChildren = nodes.filter(
                    n => n.parentId === frameId && !parentedNodes.some(p => p.id === n.id)
                );

                if (remainingChildren.length === 0) {
                    txs.push({ type: 'REMOVE_NODE', payload: frameId });
                } else {
                    // Recalculate Frame Bounds
                    let minX = Infinity, minY = Infinity;
                    let maxX = -Infinity, maxY = -Infinity;

                    remainingChildren.forEach(child => {
                        const w = child.measured?.width ?? child.width ?? 150;
                        const h = child.measured?.height ?? child.height ?? 50;
                        minX = Math.min(minX, child.position.x);
                        minY = Math.min(minY, child.position.y);
                        maxX = Math.max(maxX, child.position.x + w);
                        maxY = Math.max(maxY, child.position.y + h);
                    });

                    const PAD = 40;
                    const TOP_PAD = 40;

                    const targetLeft = minX - PAD;
                    const targetTop = minY - TOP_PAD;
                    const newWidth = (maxX + PAD) - targetLeft;
                    const newHeight = (maxY + PAD) - targetTop;

                    // Shift delta (how much the frame moves)
                    const shiftX = targetLeft;
                    const shiftY = targetTop;

                    // 1. Move/Resize Frame
                    txs.push({
                        type: 'MOVE_NODE',
                        payload: {
                            id: frameId,
                            position: {
                                x: parentFrame.position.x + shiftX,
                                y: parentFrame.position.y + shiftY
                            },
                            oldPosition: { ...parentFrame.position }
                        }
                    });

                    txs.push({
                        type: 'UPDATE_NODE_DATA',
                        payload: {
                            id: frameId,
                            data: {
                                width: Math.round(newWidth),
                                height: Math.round(newHeight)
                            }
                        }
                    });

                    // 2. Shift Children (to stay in place absolute)
                    // New Relative = Old Relative - Shift
                    remainingChildren.forEach(child => {
                        txs.push({
                            type: 'MOVE_NODE',
                            payload: {
                                id: child.id,
                                position: {
                                    x: child.position.x - shiftX,
                                    y: child.position.y - shiftY
                                },
                                oldPosition: { ...child.position }
                            }
                        });
                    });
                }
            });

            Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });
            return;
        }

        // --- GROUP: create new frame ---
        const selectedNodes = selectedNonFrame.filter(n => !n.parentId);
        if (selectedNodes.length === 0) return;

        // 1. Calculate bounding box with safe dimension fallbacks
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        selectedNodes.forEach(node => {
            const w = node.measured?.width ?? node.width ?? 150;
            const h = node.measured?.height ?? node.height ?? 50;
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + w);
            maxY = Math.max(maxY, node.position.y + h);
        });

        // 2. Add padding (extra top for label)
        const PAD = 40;
        const TOP_PAD = 40;
        minX -= PAD;
        minY -= TOP_PAD;
        maxX += PAD;
        maxY += PAD;

        const width = maxX - minX;
        const height = maxY - minY;
        const frameId = generateNodeId('frame');

        // 3. Build Brain transactions
        const txs: Transaction[] = [];

        txs.push({
            type: 'ADD_NODE',
            payload: {
                id: frameId,
                type: 'frame',
                position: { x: minX, y: minY },
                data: { label: 'Group', width, height },
                initialValue: { type: 'void', value: null, symbol: null }
            }
        });

        selectedNodes.forEach(node => {
            txs.push({
                type: 'UPDATE_NODE_DATA',
                payload: { id: node.id, data: { parentId: frameId } }
            });
            txs.push({
                type: 'MOVE_NODE',
                payload: {
                    id: node.id,
                    position: { x: node.position.x - minX, y: node.position.y - minY },
                    oldPosition: { ...node.position }
                }
            });
        });

        Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });
    }, [getNodes]);

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
            Brain.getInstance().applyTransaction({ type: 'BATCH', payload: txs });
        }
    }, [getNodes, getEdges]);

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
