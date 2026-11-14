'use client';

import { useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useBrain } from '../context/BrainContext';
import { useHistoryStore, HistoryEntry } from '../store/useHistoryStore';
import { Transaction } from '../engine/types/engineTypes';
import { PayloadUtils } from '../utils/PayloadUtils';

/**
 * Node field edits that are recorded in the history store.
 *
 * The Brain stays the source of truth: every edit is applied through
 * `brain.applyTransaction` (never silent) and only recorded when the Brain
 * accepted it. The inverse always carries the full previous `data` so undo
 * restores fields the patch did not touch.
 */

/** Burst window used when a caller does not pass `mergeWindowMs`. */
export const DEFAULT_NODE_EDIT_MERGE_MS = 500;

/** Last edit timestamp per merge key, so typing collapses into one undo step. */
const lastEditAt = new Map<string, number>();

let entryCounter = 0;

function payloadId(tx: Transaction): string | undefined {
    const payload = tx.payload as { id?: unknown } | null | undefined;
    return typeof payload?.id === 'string' ? payload.id : undefined;
}

export interface NodeEditOptions {
    description: string;
    /** Entry id reused across a burst of edits of the same field. */
    mergeId?: string;
    /** Overrides DEFAULT_NODE_EDIT_MERGE_MS for this call. */
    mergeWindowMs?: number;
}

export function useNodeEdit(options: { isReadOnly?: boolean } = {}) {
    const { isReadOnly = false } = options;
    const { getNodes } = useReactFlow();
    const brain = useBrain();
    const push = useHistoryStore(s => s.push);

    /**
     * Records the entry, merging into the previous one when the burst window
     * still applies. Falls back to `push` when `replaceLast` refuses, so this
     * returns true whenever the Brain accepted the transaction.
     */
    const commit = useCallback((
        description: string,
        forward: Transaction[],
        inverse: Transaction[],
        mergeId?: string,
        mergeWindowMs?: number
    ): boolean => {
        const now = Date.now();
        const window = mergeWindowMs ?? DEFAULT_NODE_EDIT_MERGE_MS;
        const lastAt = mergeId ? lastEditAt.get(mergeId) : undefined;

        if (mergeId && lastAt !== undefined && now - lastAt < window) {
            const store = useHistoryStore.getState();
            const last = store.past.at(-1);
            if (last && last.id === mergeId) {
                // First inverse per node id wins, so undo returns to the value
                // before typing started rather than the previous keystroke.
                const firstInverseById = new Map<string, Transaction>();
                for (const tx of last.inverse ?? []) {
                    const id = payloadId(tx);
                    if (id && !firstInverseById.has(id)) firstInverseById.set(id, tx);
                }
                const mergedInverse = inverse.map(tx => {
                    const id = payloadId(tx);
                    const first = id ? firstInverseById.get(id) : undefined;
                    return first ?? tx;
                });

                const merged: HistoryEntry = {
                    id: mergeId,
                    description,
                    forward,
                    inverse: mergedInverse,
                };

                if (store.replaceLast(mergeId, merged)) {
                    lastEditAt.set(mergeId, now);
                    return true;
                }
            }
        }

        const id = mergeId ?? `edit_${now}_${++entryCounter}`;
        push({ id, description, forward, inverse });
        if (mergeId) lastEditAt.set(mergeId, now);
        return true;
    }, [push]);

    /**
     * Patches `data` on several nodes in one BATCH.
     * Inverse stores the complete previous data object per node.
     */
    const editNodesData = useCallback((
        edits: Array<{ id: string; patch: Record<string, unknown> }>,
        opts: NodeEditOptions
    ): boolean => {
        if (isReadOnly || edits.length === 0) return false;

        const nodesById = new Map(getNodes().map(node => [node.id, node]));
        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];

        for (const { id, patch } of edits) {
            const node = nodesById.get(id);
            if (!node) continue;
            forward.push({ type: 'UPDATE_NODE_DATA', payload: { id, data: patch } });
            inverse.push({
                type: 'UPDATE_NODE_DATA',
                payload: { id, data: { ...(node.data ?? {}) } },
            });
        }

        if (forward.length === 0) return false;

        const result = brain.applyTransaction({ type: 'BATCH', payload: forward });
        if (!result.success) return false;

        return commit(opts.description, forward, inverse, opts.mergeId, opts.mergeWindowMs);
    }, [isReadOnly, getNodes, brain, commit]);

    /**
     * Writes a node's `value` through UPDATE_VALUE.
     * The inverse unwraps the UI-side payload back to a raw value.
     */
    const editNodeValue = useCallback((
        id: string,
        value: unknown,
        opts: { description?: string; mergeId?: string; mergeWindowMs?: number } = {}
    ): boolean => {
        if (isReadOnly) return false;

        const node = getNodes().find(n => n.id === id);
        if (!node) return false;

        const forward: Transaction[] = [
            { type: 'UPDATE_VALUE', payload: { id, value } },
        ];
        const inverse: Transaction[] = [
            { type: 'UPDATE_VALUE', payload: { id, value: PayloadUtils.unwrap(node.data?.value) } },
        ];

        const result = brain.applyTransaction(forward[0]);
        if (!result.success) return false;

        return commit(opts.description ?? 'Edit Value', forward, inverse, opts.mergeId, opts.mergeWindowMs);
    }, [isReadOnly, getNodes, brain, commit]);

    return useMemo(() => ({ editNodesData, editNodeValue }), [editNodesData, editNodeValue]);
}
