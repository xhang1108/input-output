import { useCallback, useRef } from 'react';
import { useReactFlow, Node, Edge, XYPosition } from '@xyflow/react';
import { useBrain } from '../context/BrainContext';
import { useHistoryStore } from '../store/useHistoryStore';
import { SCHEMA_VERSION } from '../engine/schema';
import { Transaction } from '../engine/types/engineTypes';
import {
    CLIPBOARD_SOURCE,
    ClipboardBuffer,
    buildInsertTransactions,
    deepCloneWithFallback,
    expandSelectionWithDescendants,
    planPaste,
} from '../utils/clipboardMath';

/**
 * useClipboard
 * Handles duplicate, copy, cut and paste operations on nodes and edges.
 *
 * Clipboard truth is in-memory (DEC-5): a ref, never localStorage.
 *
 * Frame rule (docs/frame-integration.md §3-D8): selecting a frame selects its
 * whole group. Every read of the selection goes through
 * `expandSelectionWithDescendants`, so the buffer always holds the frame and
 * its children together, parent-first. Paste then allocates new ids, remaps
 * `parentId` to the new frame id and keeps child positions parent-local.
 */
export function useClipboard() {
    const { getNodes, getEdges } = useReactFlow();
    const brain = useBrain();
    const pushHistory = useHistoryStore(s => s.push);

    // DEC-5: in-memory clipboard. Survives re-renders, not reloads or tab boundaries.
    const clipboardRef = useRef<ClipboardBuffer | null>(null);

    /**
     * Selected nodes plus all of their descendants, parent-first.
     * Returns an empty array when nothing is selected.
     */
    const getSelectionWithDescendants = useCallback((nodes: Node[]): Node[] => {
        const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
        if (selectedIds.size === 0) return [];
        return expandSelectionWithDescendants(nodes, selectedIds);
    }, []);

    // --- Command: Duplicate (Immediate) ---
    // DEC-2: behavior unchanged — fixed {20,20} offset, group keeps relative
    // positions, returns the new nodes so FlowCanvas can startGrab().
    // Uses the same planPaste pipeline as the clipboard so Frame children follow
    // the DEC-6 B rule instead of drifting inside their original frame.
    const duplicateSelected = useCallback((): { nodes: Node[], edges: Edge[] } | false => {
        const nodes = getNodes();
        // A selected frame brings its children, otherwise the duplicate would be
        // an empty frame and the children would be detached by DEC-6 B.
        const selectedNodes = getSelectionWithDescendants(nodes);
        if (selectedNodes.length === 0) return false;

        const edges = getEdges();
        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const edgesToClone = edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));

        const plan = planPaste({
            buffer: {
                intent: 'copy',
                nodes: deepCloneWithFallback(selectedNodes),
                edges: deepCloneWithFallback(edgesToClone),
                schemaVersion: SCHEMA_VERSION,
                source: CLIPBOARD_SOURCE,
            },
            liveNodes: nodes,
            liveEdges: edges,
            // No target position: computePasteOffset falls back to {20,20} (DEC-2).
        });
        if (!plan) return false;

        const res = brain.applyTransaction({ type: 'BATCH', payload: plan.forward });
        if (!res.success) {
            console.warn('[useClipboard] Duplicate aborted, transaction failed:', res.reason);
            return false;
        }

        pushHistory({
            id: `duplicate_${Date.now()}`,
            description: `Duplicate ${plan.nodes.length} nodes`,
            forward: plan.forward,
            inverse: plan.inverse
        });

        return { nodes: plan.nodes, edges: plan.edges };
    }, [getNodes, getEdges, getSelectionWithDescendants, brain, pushHistory]);

    // --- Command: Copy to Clipboard ---
    const copyToClipboard = useCallback((): boolean => {
        const nodes = getNodes();
        // Frame-aware: a selected frame is copied together with its descendants.
        const selectedNodes = getSelectionWithDescendants(nodes);
        if (selectedNodes.length === 0) return false;

        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const edgesToCopy = getEdges().filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));

        clipboardRef.current = {
            intent: 'copy',
            // DEC-5/§6.9: snapshot with structuredClone (JSON fallback) instead of
            // a full JSON round-trip through localStorage.
            nodes: deepCloneWithFallback(selectedNodes),
            edges: deepCloneWithFallback(edgesToCopy),
            schemaVersion: SCHEMA_VERSION,
            source: CLIPBOARD_SOURCE,
        };

        return true;
    }, [getNodes, getEdges, getSelectionWithDescendants]);

    // --- Command: Cut ---
    // DEC-4: cutting disconnects boundary edges; paste never reconnects them.
    // Must NOT call useSelection.deleteSelected(): it pushes its own history and
    // its inverse ADD_NODE misses `initialValue`.
    const cutSelected = useCallback((): boolean => {
        const nodes = getNodes();
        // Frame-aware: cutting a frame cuts its descendants too. REMOVE_NODE
        // never cascades, so leaving children behind would orphan their
        // `parentId`; the buffer keeps the whole group for the paste.
        const selectedNodes = getSelectionWithDescendants(nodes);
        if (selectedNodes.length === 0) return false;

        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const edges = getEdges();
        const internalEdges = edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));
        // REMOVE_NODE cascades every touching edge, including boundary ones.
        const boundaryEdges = edges.filter(e => selectedNodeIds.has(e.source) || selectedNodeIds.has(e.target));

        const buffer: ClipboardBuffer = {
            intent: 'cut',
            nodes: deepCloneWithFallback(selectedNodes),
            edges: deepCloneWithFallback(internalEdges),
            schemaVersion: SCHEMA_VERSION,
            source: CLIPBOARD_SOURCE,
        };

        // Parent-first order in the buffer (for the ADD_NODE inverse) becomes
        // children-first here, so a frame is deleted only after its children.
        const hasHierarchy = selectedNodes.some(n => !!n.parentId && selectedNodeIds.has(n.parentId));
        const removeOrder = hasHierarchy ? [...selectedNodes].reverse() : selectedNodes;

        const forwardTxs: Transaction[] = removeOrder.map(n => ({
            type: 'REMOVE_NODE',
            payload: n.id
        } as Transaction));

        // Undo: nodes first (with engine value), then every edge that was
        // cascaded away — internal and boundary alike.
        const inverseTxs: Transaction[] = buildInsertTransactions(buffer.nodes, boundaryEdges);

        const res = brain.applyTransaction({ type: 'BATCH', payload: forwardTxs });
        if (!res.success) {
            console.warn('[useClipboard] Cut aborted, transaction failed:', res.reason);
            return false;
        }

        // Only commit the buffer after success, so a rejected cut cannot leave a
        // stale "cut" intent behind (§6.3 / DEC-4).
        clipboardRef.current = buffer;

        pushHistory({
            id: `cut_${Date.now()}`,
            description: `Cut ${selectedNodes.length} nodes`,
            forward: forwardTxs,
            inverse: inverseTxs
        });

        return true;
    }, [getNodes, getEdges, getSelectionWithDescendants, brain, pushHistory]);

    // --- Command: Paste from Clipboard ---
    // DEC-1: bbox center lands on the flow-space target position.
    // DEC-3: copy → new ids; cut → reuse ids when they are actually free.
    // DEC-6 B: child whose parent is not in the buffer becomes independent.
    const pasteFromClipboard = useCallback((targetPos?: XYPosition): boolean => {
        const plan = planPaste({
            buffer: clipboardRef.current,
            liveNodes: getNodes(),
            liveEdges: getEdges(),
            targetPos,
        });

        // Empty buffer or 0 pasted nodes: no transaction, no history entry (§6.3).
        if (!plan) return false;

        const res = brain.applyTransaction({ type: 'BATCH', payload: plan.forward });
        if (!res.success) {
            console.warn('[useClipboard] Paste aborted, transaction failed:', res.reason);
            return false;
        }

        pushHistory({
            id: `paste_${Date.now()}`,
            description: `Paste ${plan.nodes.length} nodes`,
            forward: plan.forward,
            inverse: plan.inverse
        });

        return true;
    }, [getNodes, getEdges, brain, pushHistory]);

    return {
        duplicateSelected,
        copyToClipboard,
        cutSelected,
        pasteFromClipboard,
    };
}
