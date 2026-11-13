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
    planPaste,
} from '../utils/clipboardMath';

/**
 * useClipboard
 * Handles duplicate, copy, cut and paste operations on nodes and edges.
 *
 * Clipboard truth is in-memory (DEC-5): a ref, never localStorage.
 */
export function useClipboard() {
    const { getNodes, getEdges } = useReactFlow();
    const brain = useBrain();
    const pushHistory = useHistoryStore(s => s.push);

    // DEC-5: in-memory clipboard. Survives re-renders, not reloads or tab boundaries.
    const clipboardRef = useRef<ClipboardBuffer | null>(null);

    // --- Command: Duplicate (Immediate) ---
    // DEC-2: behavior unchanged — fixed {20,20} offset, group keeps relative
    // positions, returns the new nodes so FlowCanvas can startGrab().
    // Uses the same planPaste pipeline as the clipboard so Frame children follow
    // the DEC-6 B rule instead of drifting inside their original frame.
    const duplicateSelected = useCallback((): { nodes: Node[], edges: Edge[] } | false => {
        const nodes = getNodes();
        const selectedNodes = nodes.filter(n => n.selected);
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
    }, [getNodes, getEdges, brain, pushHistory]);

    // --- Command: Copy to Clipboard ---
    const copyToClipboard = useCallback((): boolean => {
        const selectedNodes = getNodes().filter(n => n.selected);
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
    }, [getNodes, getEdges]);

    // --- Command: Cut ---
    // DEC-4: cutting disconnects boundary edges; paste never reconnects them.
    // Must NOT call useSelection.deleteSelected(): it pushes its own history and
    // its inverse ADD_NODE misses `initialValue`.
    const cutSelected = useCallback((): boolean => {
        const nodes = getNodes();
        const selectedNodes = nodes.filter(n => n.selected);
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

        const forwardTxs: Transaction[] = selectedNodes.map(n => ({
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
    }, [getNodes, getEdges, brain, pushHistory]);

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
