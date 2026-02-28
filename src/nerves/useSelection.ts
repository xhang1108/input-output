import { useCallback } from 'react';
import { useReactFlow, Node } from '@xyflow/react';
import { generateNodeId, generateEdgeId } from '../utils/idGenerator';
import { Brain } from '../engine/Brain';
import { Transaction } from '../engine/types';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';
import { HandleConfig } from '../types/NodeDefinition';

/**
 * useSelection
 * Handles node selection, deletion, reset, bundle, detach, and swap.
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
                    label: n.type === 'frame' ? 'Frame' : 'Node'
                }
            };
        }));
    }, [setNodes]);

    // --- Command: Bundle / Unbundle Toggle (F key) ---
    const bundleSelected = useCallback(() => {
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
                const frameWidth = Number(parentFrame?.data?.width ?? parentFrame?.measured?.width ?? parentFrame?.width ?? 0);
                const frameHeight = Number(parentFrame?.data?.height ?? parentFrame?.measured?.height ?? parentFrame?.height ?? 0);

                const frameTL_X = (parentFrame?.position.x ?? 0) - frameWidth / 2;
                const frameTL_Y = (parentFrame?.position.y ?? 0) - frameHeight / 2;

                const absX = frameTL_X + node.position.x;
                const absY = frameTL_Y + node.position.y;

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
                        minX = Math.min(minX, child.position.x - w / 2);
                        minY = Math.min(minY, child.position.y - h / 2);
                        maxX = Math.max(maxX, child.position.x + w / 2);
                        maxY = Math.max(maxY, child.position.y + h / 2);
                    });

                    const PAD = 40;
                    const TOP_PAD = 40;

                    const targetLeft = minX - PAD;
                    const targetTop = minY - TOP_PAD;
                    const newWidth = (maxX + PAD) - targetLeft;
                    const newHeight = (maxY + PAD) - targetTop;

                    const oldFrameWidth = Number(parentFrame.data?.width ?? parentFrame.measured?.width ?? parentFrame.width ?? 0);
                    const oldFrameHeight = Number(parentFrame.data?.height ?? parentFrame.measured?.height ?? parentFrame.height ?? 0);
                    const oldFrameTL_X = parentFrame.position.x - oldFrameWidth / 2;
                    const oldFrameTL_Y = parentFrame.position.y - oldFrameHeight / 2;

                    const newFrameTL_X = oldFrameTL_X + targetLeft;
                    const newFrameTL_Y = oldFrameTL_Y + targetTop;

                    const newAbsCenterX = newFrameTL_X + newWidth / 2;
                    const newAbsCenterY = newFrameTL_Y + newHeight / 2;

                    // 1. Move/Resize Frame
                    txs.push({
                        type: 'MOVE_NODE',
                        payload: {
                            id: frameId,
                            position: {
                                x: newAbsCenterX,
                                y: newAbsCenterY
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
                    remainingChildren.forEach(child => {
                        txs.push({
                            type: 'MOVE_NODE',
                            payload: {
                                id: child.id,
                                position: {
                                    x: child.position.x - targetLeft,
                                    y: child.position.y - targetTop
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
            minX = Math.min(minX, node.position.x - w / 2);
            minY = Math.min(minY, node.position.y - h / 2);
            maxX = Math.max(maxX, node.position.x + w / 2);
            maxY = Math.max(maxY, node.position.y + h / 2);
        });

        // 2. Add padding (extra top for label)
        const PAD = 40;
        const TOP_PAD = 40;

        const targetLeft = minX - PAD;
        const targetTop = minY - TOP_PAD;
        const width = (maxX + PAD) - targetLeft;
        const height = (maxY + PAD) - targetTop;
        const frameId = generateNodeId('frame');

        const frameCenterX = targetLeft + width / 2;
        const frameCenterY = targetTop + height / 2;

        // 3. Build Brain transactions
        const txs: Transaction[] = [];

        txs.push({
            type: 'ADD_NODE',
            payload: {
                id: frameId,
                type: 'frame',
                position: { x: frameCenterX, y: frameCenterY },
                width: Math.round(width),
                height: Math.round(height),
                style: { width: Math.round(width), height: Math.round(height) },
                data: { label: 'Frame', width: Math.round(width), height: Math.round(height) },
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
                    position: { x: node.position.x - targetLeft, y: node.position.y - targetTop },
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
        bundleSelected,
        detachSelected,
        swapConnections,
        clearSelection,
        selectNode,
    };
}
