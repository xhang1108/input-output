import { useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Brain } from '../engine/Brain';
import { NodeLogic } from '../engine/types';
import { PayloadUtils } from '../utils/PayloadUtils';
import { useAppStore } from '../store/useStore';
import deepEqual from 'fast-deep-equal';

/**
 * liftStructuralProps
 * 
 * Extracts Frame-related properties from Brain's NodeLogic.data
 * and returns them as top-level React Flow Node properties.
 * 
 * Brain stores everything in `data`. React Flow expects structural
 * properties (parentId, extent, expandParent) at the Node root level,
 * and dimensions in `style`. This function bridges that gap.
 */
function liftStructuralProps(logicNode: NodeLogic) {
    const d = logicNode.data || {};

    // Destructure structural props from data, leaving the rest as display data
    const { parentId, extent, expandParent, width, height, ...displayData } = d;
    // NOTE: We intentionally do NOT lift `extent` or `expandParent` to Node root.
    // Setting extent='parent' causes React Flow to call clampPositionToParent,
    // which crashes if the parent hasn't been measured yet.

    // Build style object for dimensions and z-index
    const style: Record<string, unknown> = {};
    if (width != null) style.width = width;
    if (height != null) style.height = height;

    // Z-index: Frames sit behind everything, children sit above
    if (logicNode.type === 'frame') {
        style.zIndex = -100;
    } else if (parentId) {
        style.zIndex = 100;
    }

    return {
        // Top-level structural props (React Flow reads these)
        parentId: parentId as string | undefined,
        // Center Origin for Spatial Geometric Law (Exempt Matrix Input for stable resizing)
        origin: ((logicNode.type === 'matrixInput' || logicNode.type === 'IO-08')
            ? [0, 0]
            : [0.5, 0.5]) as [number, number],
        // extent and expandParent intentionally omitted (see note above)
        width: width as number | undefined,
        height: height as number | undefined,
        style,
        // Clean display data (still includes parentId etc. for data consumers)
        displayData: { ...d, value: undefined }, // value set separately
    };
}

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
                        const lifted = liftStructuralProps(logicNode);
                        // FIX: Pass full payload object
                        const unwrappedValue = logicNode.value; // Was: PayloadUtils.unwrap(logicNode.value);
                        const targetData = { ...lifted.displayData, value: unwrappedValue };

                        const existingIndex = nextNodes.findIndex(n => n.id === id);

                        if (existingIndex === -1) {
                            // New node (from Brain transaction, undo, or load)
                            nextNodes.push({
                                id,
                                position: logicNode.position || { x: 0, y: 0 },
                                data: targetData,
                                type: logicNode.type || 'mathNode',
                                parentId: lifted.parentId,
                                width: lifted.width,
                                height: lifted.height,
                                origin: lifted.origin,
                                style: lifted.style,
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
                            if (uiNode.parentId !== lifted.parentId) {
                                needsUpdate = true;
                            }

                            if (needsUpdate) {
                                nextNodes[existingIndex] = {
                                    ...uiNode,
                                    data: targetData,
                                    position: newPos,
                                    parentId: lifted.parentId,
                                    width: lifted.width,
                                    height: lifted.height,
                                    origin: lifted.origin,
                                    style: { ...uiNode.style, ...lifted.style },
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
                            nextEdges.push(existing); // Keep UI edge (has extra props like data.pathType)
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

        // Listen for import performance metrics
        const { setLastImportMs } = useAppStore.getState();
        const cleanupImport = brain.on('importFinished', (ms: unknown) => {
            setLastImportMs(ms as number);
        });

        return () => {
            cleanup();
            cleanupImport();
        };
    }, [setNodes, setEdges]);
}
