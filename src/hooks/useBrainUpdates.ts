import { useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Brain } from '../engine/Brain';
import { NodeLogic } from '../engine/types';
import { PayloadUtils } from '../utils/PayloadUtils';
import { useAppStore } from '../store/useStore';
import deepEqual from 'fast-deep-equal';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';

import { DEFAULT_UI_ORIGIN } from '../types/NodeDefinition';

/**
 * useBrainUpdates
 * 
 * Listens to Brain 'graphChanged' events and syncs state
 * back to React Flow nodes and edges.
 */

/**
 * useBrainUpdates
 * 
 * Listens to Brain 'graphChanged' events and syncs state
 * back to React Flow nodes and edges.
 */
export function useBrainUpdates(
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
) {
    useEffect(() => {
        const brain = Brain.getInstance();

        const handleGraphChange = (payload?: unknown) => {
            const forceFullSync = payload === true;
            const updates = payload instanceof Map ? payload as Map<string, unknown> : null;

            if (updates) {
                // Partial update (value changes only)
                setNodes(currentNodes => {
                    let changed = false;
                    const nextNodes = currentNodes.map(node => {
                        if (updates.has(node.id)) {
                            const rawPayload = updates.get(node.id);
                            // FIX: Do NOT unwrap here. Pass full payload to UI so ResultNode gets metadata.
                            const newValue = rawPayload; // Was: PayloadUtils.unwrap(rawPayload);

                            if (node.data.value !== newValue) {
                                changed = true;
                                return {
                                    ...node,
                                    data: { ...node.data, value: newValue }
                                };
                            }
                        }
                        return node;
                    });
                    return changed ? nextNodes : currentNodes;
                });
            } else {
                // Full topology sync (structure changes, undo/redo, etc.)
                const brainNodes = brain.getNodesMap();

                setNodes(currentNodes => {
                    const nextNodes = [...currentNodes];
                    let changed = false;

                    // 1. Remove nodes not in Brain
                    for (let i = nextNodes.length - 1; i >= 0; i--) {
                        if (!brainNodes.has(nextNodes[i].id)) {
                            nextNodes.splice(i, 1);
                            changed = true;
                        }
                    }

                    // 2. Add/Update nodes from Brain
                    for (const [id, logicNode] of brainNodes) {
                        const existingIndex = nextNodes.findIndex(n => n.id === id);
                        const existingNode = existingIndex !== -1 ? nextNodes[existingIndex] : null;

                        // DIRTY GUARD: If the node is currently in the dirty chain, the Brain's 
                        // cached value is stale (awaiting re-computation). We keep the UI's 
                        // existing value to prevent "flickering" or "reverting" during sync.
                        let unwrappedValue = logicNode.value;
                        if (logicNode.isInDirtyChain && existingNode) {
                            unwrappedValue = existingNode.data.value as any;
                        }

                        // 1. Determine structural props (parentId and Origin)
                        const d = logicNode.data || {};
                        const { width: _dataWidth, height: _dataHeight, parentId: _dataParentId, ...displayData } = d;

                        // Prioritize top-level width/height (updated by RESIZE_NODE)
                        const width = logicNode.width ?? _dataWidth;
                        const height = logicNode.height ?? _dataHeight;

                        // Re-insert into targetData for components relying on data.width/height
                        const targetData = {
                            ...displayData,
                            width,
                            height,
                            value: unwrappedValue
                        };

                        const style: Record<string, any> = {};
                        if (width != null) style.width = width;
                        if (height != null) style.height = height;
                        if (logicNode.type === 'frame') style.zIndex = -100;
                        else if (logicNode.parentId) style.zIndex = 100;

                        let uiOrigin = existingNode?.origin || DEFAULT_UI_ORIGIN;
                        const def = NODE_DEFINITIONS.find(def => def.id === logicNode.type);
                        if (def && def.layoutMetadata) {
                            uiOrigin = def.layoutMetadata.uiOrigin;
                        } else if (logicNode.type === 'frame') {
                            uiOrigin = [0, 0];
                        }

                        if (existingIndex === -1) {
                            // New node (from Brain transaction, undo, or load)
                            nextNodes.push({
                                id,
                                position: logicNode.position || { x: 0, y: 0 },
                                data: targetData,
                                type: logicNode.type || 'mathNode',
                                parentId: logicNode.parentId,
                                width: width as number,
                                height: height as number,
                                origin: uiOrigin,
                                style: style,
                                selected: logicNode.selected || false
                            } as Node);
                            changed = true;
                        } else {
                            // Update existing node
                            const uiNode = nextNodes[existingIndex];
                            let needsUpdate = false;

                            // Check data changes
                            if (!deepEqual(uiNode.data, targetData)) {
                                needsUpdate = true;
                            }

                            // Check position changes
                            let newPos = uiNode.position;
                            if (logicNode.position &&
                                (Math.abs(uiNode.position.x - logicNode.position.x) > 0.1 ||
                                    Math.abs(uiNode.position.y - logicNode.position.y) > 0.1)) {
                                newPos = { ...logicNode.position };
                                needsUpdate = true;
                            }

                            // Check structural changes
                            if (uiNode.parentId !== logicNode.parentId) {
                                needsUpdate = true;
                            }

                            if (needsUpdate || uiNode.selected !== logicNode.selected) {
                                // Selection logic (UI wins for false-positives)
                                const finalSelected = (uiNode.selected && !logicNode.selected) ? true : (logicNode.selected ?? false);

                                nextNodes[existingIndex] = {
                                    ...uiNode,
                                    data: targetData,
                                    position: newPos,
                                    parentId: logicNode.parentId,
                                    width: width as number,
                                    height: height as number,
                                    origin: uiOrigin,
                                    style: { ...uiNode.style, ...style },
                                    selected: finalSelected
                                };
                                changed = true;
                            }
                        }
                    }

                    // CRITICAL: React Flow requires parent nodes to appear BEFORE
                    // their children in the array. Sort: parentless first, then children.
                    if (changed) {
                        nextNodes.sort((a, b) => {
                            const aIsChild = a.parentId ? 1 : 0;
                            const bIsChild = b.parentId ? 1 : 0;
                            return aIsChild - bIsChild;
                        });
                    }

                    return changed ? nextNodes : currentNodes;
                });

                // Sync Edges — preserve Brain's array order for capsule slot ordering
                const brainEdges = brain.getEdges();
                setEdges(currentEdges => {
                    const brainEdgeIds = new Set(brainEdges.map(e => e.id));
                    const uiEdgeMap = new Map(currentEdges.map(e => [e.id, e]));
                    let edgesChanged = false;

                    // Build new edge array following Brain's order
                    const nextEdges: Edge[] = [];
                    for (const brainEdge of brainEdges) {
                        const existing = uiEdgeMap.get(brainEdge.id);
                        if (existing) {
                            // Merge Brain's data (active flag, etc.) into existing UI edge
                            // UI edge keeps pathType, isHighlighted, etc.
                            const mergedData = { ...existing.data, ...brainEdge.data };
                            const dataChanged = existing.data?.active !== mergedData.active;
                            if (dataChanged) {
                                nextEdges.push({ ...existing, data: mergedData });
                                edgesChanged = true;
                            } else {
                                nextEdges.push(existing);
                            }
                        } else {
                            nextEdges.push(brainEdge); // Add new edge from Brain
                            edgesChanged = true;
                        }
                    }

                    // Check if any UI edges were removed
                    for (const uiEdge of currentEdges) {
                        if (!brainEdgeIds.has(uiEdge.id)) {
                            edgesChanged = true;
                        }
                    }

                    // Check if order changed OR if we are forcing a full context swap
                    if (forceFullSync || (!edgesChanged && nextEdges.length === currentEdges.length)) {
                        if (forceFullSync) edgesChanged = true;
                        for (let i = 0; i < nextEdges.length; i++) {
                            if (nextEdges[i].id !== currentEdges[i].id) {
                                edgesChanged = true;
                                break;
                            }
                        }
                    }

                    return edgesChanged ? nextEdges : currentEdges;
                });
            }
        };

        const cleanup = brain.on('graphChanged', (payload: unknown) => handleGraphChange(payload));

        // Listen for edge active state changes (signal flow)
        const cleanupEdges = brain.on('edgesChanged', () => {
            const brainEdges = brain.getEdges();
            setEdges(currentEdges => {
                const uiEdgeMap = new Map(currentEdges.map(e => [e.id, e]));
                let changed = false;
                const nextEdges = brainEdges.map(brainEdge => {
                    const existing = uiEdgeMap.get(brainEdge.id);
                    if (!existing) return brainEdge;
                    const active = brainEdge.data?.active;
                    if (existing.data?.active === active) return existing;
                    changed = true;
                    return { ...existing, data: { ...existing.data, active } };
                });
                return changed ? nextEdges : currentEdges;
            });
        });

        // Listen for import performance metrics
        const { setLastImportMs } = useAppStore.getState();
        const cleanupImport = brain.on('importFinished', (ms: unknown) => {
            setLastImportMs(ms as number);
        });

        return () => {
            cleanup();
            cleanupEdges();
            cleanupImport();
        };
    }, [setNodes, setEdges]);
}
