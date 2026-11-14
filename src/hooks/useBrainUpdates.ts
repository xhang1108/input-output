import { useEffect, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import { NodeLogic } from '../engine/types/engineTypes';
import { PayloadUtils } from '../utils/PayloadUtils';
import { useAppStore } from '../store/useStore';
import deepEqual from 'fast-deep-equal';
import { NODE_DEFINITIONS } from '@/types/nodeDefinitions';
import { useHistoryStore } from '../store/useHistoryStore';

import { DEFAULT_UI_ORIGIN } from '../types/nodeDefinitions';

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
/** Grace period that protects a just-added UI node from a race removal. */
const RECENT_ADD_GUARD_MS = 150;

/** UI-only keys that must never be re-applied from a (possibly stale) Brain snapshot. */
const TRANSIENT_KEYS = ['isEditing', 'isTyping', 'isPending'];

export interface FullSyncOptions {
    /**
     * UI node ids added recently (ms timestamp), guarded from the removal pass.
     * Mutated when a new node is pushed, exactly like the hook's ref did.
     */
    recentlyAddedNodes: Map<string, number>;
    /**
     * Read lazily, only when a node actually needs updating: the hook's setNodes
     * updater can run after dispatch, and the selection guard must observe the
     * state at apply time (same as before the extraction).
     */
    getSelectionGuard?: () => { isRestoring: boolean; isInteracting: boolean };
    /** Injectable clock (tests). Defaults to Date.now. */
    now?: () => number;
}

const NO_SELECTION_GUARD = () => ({ isRestoring: false, isInteracting: false });

/**
 * Pure full-topology sync: UI nodes <- Brain nodes map.
 *
 * Complexity: O(n) — the id -> index lookup is a Map built once, after the
 * removal pass (removals splice, so earlier indices are not trustworthy).
 * Returns `currentNodes` (same reference) when nothing changed.
 */
export function applyFullSync(
    currentNodes: Node[],
    brainNodes: Map<string, NodeLogic>,
    options: FullSyncOptions
): Node[] {
    const now = options.now ?? Date.now;
    const getSelectionGuard = options.getSelectionGuard ?? NO_SELECTION_GUARD;
    const recentlyAddedNodes = options.recentlyAddedNodes;

    const nextNodes = [...currentNodes];
    let changed = false;

    // 1. Remove nodes not in Brain
    for (let i = nextNodes.length - 1; i >= 0; i--) {
        if (!brainNodes.has(nextNodes[i].id)) {
            // RECOVERY GUARD: Check for recently added nodes to prevent race removals
            const addedTime = recentlyAddedNodes.get(nextNodes[i].id);
            if (addedTime && now() - addedTime < RECENT_ADD_GUARD_MS) {
                continue;
            }

            console.log(`[useBrainUpdates] Syncing node removal: ${nextNodes[i].id} (missing from Brain state)`);
            nextNodes.splice(i, 1);
            changed = true;
        }
    }

    // Index by id once. First occurrence wins, matching the old findIndex.
    const indexById = new Map<string, number>();
    for (let i = 0; i < nextNodes.length; i++) {
        if (!indexById.has(nextNodes[i].id)) indexById.set(nextNodes[i].id, i);
    }

    // 2. Add/Update nodes from Brain
    for (const [id, logicNode] of brainNodes) {
        const existingIndex = indexById.get(id) ?? -1;
        const existingNode = existingIndex !== -1 ? nextNodes[existingIndex] : null;

        // DIRTY GUARD: If the node is currently in the dirty chain, the Brain's
        // cached value is stale (awaiting re-computation). We keep the UI's
        // existing value to prevent "flickering" or "reverting" during sync.
        // EXCEPTION: If the UI value is nullish, we trust the Brain's value
        // to ensure new nodes/fresh imports show their initial symbols.
        let unwrappedValue = logicNode.value;
        if (logicNode.isInDirtyChain && existingNode && existingNode.data.value != null) {
            unwrappedValue = existingNode.data.value as any;
        }

        const isInput = logicNode.id.startsWith('IN-') || logicNode.type?.startsWith('IN-');

        const sourceVal = unwrappedValue ?? logicNode.data.value;
        let finalValue = isInput ? PayloadUtils.unwrap(sourceVal) : sourceVal;

        // NEW GUARD: Input Persistence Guard
        // Prevent transient engine 'null' (due to batch reconciliation race)
        // from overwriting a valid persistent user input in the UI.
        if (isInput && (finalValue === null || finalValue === undefined) && existingNode?.data?.value != null) {
            finalValue = existingNode.data.value;
        }

        // 1. Determine structural props (parentId and Origin)
        const d = logicNode.data || {};
        const { width: _dataWidth, height: _dataHeight, parentId: _dataParentId, ...displayData } = d;

        // TRANSIENT STATE ISOLATION:
        // Strip keys that strictly belong to UI-only logic (focus, editing mode).
        // This prevents a stale Brain state from "re-activating" editing mode
        // in a node that the UI has just blurred.
        TRANSIENT_KEYS.forEach(k => delete (displayData as any)[k]);

        // Prioritize top-level width/height (updated by RESIZE_NODE)
        const width = logicNode.width ?? _dataWidth;
        const height = logicNode.height ?? _dataHeight;

        // Re-insert into targetData for components relying on data.width/height
        const targetData = {
            ...displayData,
            width,
            height,
            value: finalValue
        };

        const style: Record<string, any> = {};
        if (width != null) style.width = width;
        if (height != null) style.height = height;
        if (logicNode.type === 'frame') style.zIndex = 0;
        else if (logicNode.parentId) style.zIndex = 100;
        else style.zIndex = undefined;

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
            // Pushes only append, so existing indices stay valid; register the new one.
            indexById.set(id, nextNodes.length - 1);
            recentlyAddedNodes.set(id, now());
            changed = true;
        } else {
            // Update existing node
            const uiNode = nextNodes[existingIndex];
            let needsUpdate = false;

            // Check data changes
            let dataChanged = false;

            // LOCAL STATE GUARD: If the node is currently being edited in the UI,
            // we skip overwriting its data object to prevent losing user typing.
            const isNodeEditing = uiNode.data.isEditing === true || uiNode.data.isTyping === true;

            if (!isNodeEditing && !deepEqual(uiNode.data, targetData)) {
                dataChanged = true;
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

            const newStyle = { ...uiNode.style, ...style };
            let styleChanged = false;
            // Simple shallow equality for style
            if (Object.keys(newStyle).length !== Object.keys(uiNode.style || {}).length ||
                Object.entries(newStyle).some(([k, v]) => (uiNode.style as any)?.[k] !== v)) {
                styleChanged = true;
                needsUpdate = true;
            }

            if (needsUpdate || uiNode.selected !== logicNode.selected) {
                // Selection logic: Trust UI during active interactions.
                // Brain selection only wins if we are restoring history (Undo/Redo)
                // OR if there's no active user interaction on the canvas.
                const { isRestoring, isInteracting } = getSelectionGuard();

                const finalSelected = (isRestoring || isInteracting)
                    ? uiNode.selected
                    : (logicNode.selected ?? uiNode.selected);

                nextNodes[existingIndex] = {
                    ...uiNode,
                    data: dataChanged ? targetData : uiNode.data,
                    position: newPos,
                    parentId: logicNode.parentId,
                    width: width as number,
                    height: height as number,
                    origin: uiOrigin,
                    style: styleChanged ? newStyle : uiNode.style,
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
            // Frames first (zIndex 0), then other roots, then children.
            // This keeps a frame behind unrelated nodes but above the pane.
            const rank = (n: Node) => n.type === 'frame' ? 0 : (n.parentId ? 2 : 1);
            return rank(a) - rank(b);
        });
    }

    return changed ? nextNodes : currentNodes;
}

export function useBrainUpdates(
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
) {
    const brain = useBrain();
    const recentlyAddedNodes = useRef<Map<string, number>>(new Map());

    useEffect(() => {

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
                            // FIX: If it's an Input node, we often need the raw value specifically for the text box.
                            // Result nodes need the full payload for metadata.
                            const isInput = node.id.startsWith('IN-') || node.type?.startsWith('IN-');
                            // SIGNAL FALLBACK: Use computed value if available, else use stored state (important for fresh imports)
                            const sourceValue = rawPayload ?? node.data.value;
                            const newValue = isInput ? PayloadUtils.unwrap(sourceValue) : sourceValue;

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
                // Full topology sync (structure changes, layout, etc.)
                // O(n): applyFullSync builds the id -> index Map once per sync.
                const brainNodes = brain.getNodesMap();

                setNodes(currentNodes => applyFullSync(currentNodes, brainNodes, {
                    recentlyAddedNodes: recentlyAddedNodes.current,
                    // Read lazily: React may run this updater after the dispatch.
                    getSelectionGuard: () => ({
                        isRestoring: useHistoryStore.getState().isRestoring,
                        isInteracting: brain.getStatus().isInteracting
                    })
                }));

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

                    // A length mismatch means the UI has stale/duplicate edges.
                    // Mark changed so the Brain-owned array replaces it (self-heal).
                    if (nextEdges.length !== currentEdges.length) {
                        edgesChanged = true;
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

