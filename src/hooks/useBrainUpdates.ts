import { useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Brain } from '../engine/Brain';
import { NodePayload } from '../types/payload';
import { PayloadUtils } from '../utils/PayloadUtils';

/**
 * useBrainUpdates
 * 
 * Listens to Brain 'graphChanged' events and syncs computed values
 * back to React Flow nodes' data.value.
 */
export function useBrainUpdates(
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
) {

    useEffect(() => {
        const brain = Brain.getInstance();

        const handleGraphChange = (payload: any) => {
            // Rule #6: Subscription / Protocol Law
            // If payload is a list of patches, update specific nodes.
            if (Array.isArray(payload)) {
                const updates = new Map(payload.map((p: any) => [p.id, p.value]));

                setNodes(currentNodes => currentNodes.map(node => {
                    if (updates.has(node.id)) {
                        const newValue = updates.get(node.id);
                        if (node.data.value !== newValue) {
                            return {
                                ...node,
                                data: { ...node.data, value: newValue }
                            };
                        }
                    }
                    return node;
                }));
            } else {
                // Topology / Full Sync (e.g. Undo/Redo)
                const brainNodes = brain.getNodesMap(); // Need to expose this or use getNodes()

                setNodes(currentNodes => {
                    const nextNodes = [...currentNodes];
                    const uiNodeIds = new Set(currentNodes.map(n => n.id));
                    const brainNodeIds = new Set(brainNodes.keys());
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

                        if (existingIndex === -1) {
                            // New Node from Brain (e.g. Undo Delete)
                            nextNodes.push({
                                id: id,
                                position: logicNode.position || { x: 0, y: 0 },
                                data: { ...logicNode.data, value: logicNode.value },
                                type: logicNode.type || 'mathNode'
                            });
                            changed = true;
                        } else {
                            // Update existing
                            const uiNode = nextNodes[existingIndex];
                            let newData = uiNode.data;
                            let newPos = uiNode.position;
                            let needsUpdate = false;

                            // Sync Data & Value
                            // Fix: Unwrap the NodePayload to primitive before syncing to UI data.value
                            // This prevents Control nodes (Toggle, Slider) from receiving an object instead of a primitive,
                            // which caused "stuck on true" (object is truthy) and infinite loops.
                            const unwrappedValue = PayloadUtils.unwrap(logicNode.value);
                            const targetData = { ...logicNode.data, value: unwrappedValue };

                            // Debug: Log if we are about to cause a type change loop
                            // if (typeof uiNode.data.value !== typeof unwrappedValue && uiNode.data.value !== undefined) {
                            //    console.warn(`[BrainUpdates] Type Mismatch for ${uiNode.id}! UI: ${typeof uiNode.data.value}, Brain: ${typeof unwrappedValue}`);
                            // }

                            if (JSON.stringify(uiNode.data) !== JSON.stringify(targetData)) {
                                newData = targetData;
                                needsUpdate = true;
                            }

                            // Sync Position (Phase 1.4)
                            if (logicNode.position && (Math.abs(uiNode.position.x - logicNode.position.x) > 0.1 || Math.abs(uiNode.position.y - logicNode.position.y) > 0.1)) {
                                newPos = { ...logicNode.position };
                                needsUpdate = true;
                            }

                            if (needsUpdate) {
                                nextNodes[existingIndex] = { ...uiNode, data: newData, position: newPos };
                                changed = true;
                            }
                        }
                    }

                    return changed ? nextNodes : currentNodes;
                });

                // Sync Edges (Topology)
                const brainEdges = brain.getEdges();
                setEdges(currentEdges => {
                    const brainEdgeIds = new Set(brainEdges.map(e => e.id));
                    const uiEdgeIds = new Set(currentEdges.map(e => e.id));

                    let edgesChanged = false;
                    const nextEdges = [...currentEdges];

                    // 1. Remove Edges not in Brain
                    for (let i = nextEdges.length - 1; i >= 0; i--) {
                        if (!brainEdgeIds.has(nextEdges[i].id)) {
                            // Only remove if it's not a temp edge (if we had any)
                            // Assuming all valid edges are in Brain
                            nextEdges.splice(i, 1);
                            edgesChanged = true;
                        }
                    }

                    // 2. Add Edges from Brain
                    for (const edge of brainEdges) {
                        if (!uiEdgeIds.has(edge.id)) {
                            nextEdges.push(edge);
                            edgesChanged = true;
                        }
                    }

                    return edgesChanged ? nextEdges : currentEdges;
                });
            }
        };

        const cleanup = brain.on('graphChanged', handleGraphChange);
        return cleanup;
    }, [setNodes]);
}
