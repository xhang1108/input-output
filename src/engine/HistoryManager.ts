import { Transaction } from './types';

export interface HistoryEntry {
    do: Transaction;
    undo: Transaction;
}

/**
 * Extract the affected node id from any single-node transaction (or BATCH of same-node txns).
 */
function getNodeId(tx: Transaction): string | null {
    if (tx.type === 'MOVE_NODE' || tx.type === 'RESIZE_NODE') {
        return (tx.payload as { id: string })?.id ?? null;
    }
    if (tx.type === 'UPDATE_NODE_DATA') {
        return (tx.payload as { id: string })?.id ?? null;
    }
    if (tx.type === 'BATCH') {
        const items = tx.payload as Transaction[];
        if (items.length === 0) return null;
        const ids = items.map(t => getNodeId(t)).filter((id): id is string => id !== null);
        if (ids.length === items.length && new Set(ids).size === 1) return ids[0];
    }
    return null;
}

/**
 * Returns the "canonical" key for coalescing.
 *   MOVE_NODE / RESIZE_NODE / UPDATE_NODE_DATA → that type
 *   BATCH of same-type items → that type
 *   BATCH containing RESIZE_NODE → 'RESIZE_COMMIT'
 */
function getCoalesceKey(tx: Transaction): string {
    if (tx.type === 'MOVE_NODE' || tx.type === 'RESIZE_NODE' || tx.type === 'UPDATE_NODE_DATA') {
        return tx.type;
    }
    if (tx.type === 'BATCH') {
        const items = tx.payload as Transaction[];
        const types = [...new Set(items.map(t => t.type))];
        if (types.length === 1) return types[0];
        if (types.includes('RESIZE_NODE')) return 'RESIZE_COMMIT';
    }
    return tx.type;
}

export class HistoryManager {
    private past: HistoryEntry[] = [];
    private future: HistoryEntry[] = [];
    private readonly MAX_HISTORY = 50;

    public push(entry: HistoryEntry) {
        // Any new forward action clears the redo stack
        this.future = [];

        const lastEntry = this.past[this.past.length - 1];
        if (lastEntry) {
            const lastId = getNodeId(lastEntry.do);
            const newId = getNodeId(entry.do);
            const lastKey = getCoalesceKey(lastEntry.do);
            const newKey = getCoalesceKey(entry.do);

            const sameNode = lastId !== null && newId !== null && lastId === newId;

            if (sameNode) {
                // ① Same node, same operation type → update do, keep undo (preserve start point)
                if (lastKey === newKey) {
                    lastEntry.do = entry.do;
                    return;
                }

                // ② Intermediate data update followed by the final RESIZE_COMMIT:
                //    Merge into RESIZE_COMMIT; keep the data-undo as part of the combined undo BATCH
                if (lastKey === 'UPDATE_NODE_DATA' && newKey === 'RESIZE_COMMIT') {
                    const combinedUndo: Transaction = {
                        type: 'BATCH',
                        payload: [lastEntry.undo, entry.undo]
                    };
                    lastEntry.do = entry.do;
                    lastEntry.undo = combinedUndo;
                    return;
                }

                // ③ RESIZE_COMMIT followed by a stray UPDATE_NODE_DATA (post-commit cleanup sync):
                //    Silently absorb — the resize is already the canonical record
                if (lastKey === 'RESIZE_COMMIT' && newKey === 'UPDATE_NODE_DATA') {
                    return;
                }
            }
        }

        this.past.push(entry);

        if (this.past.length > this.MAX_HISTORY) {
            this.past.shift();
        }
    }

    public undo(): HistoryEntry | null {
        if (this.past.length === 0) return null;
        const entry = this.past.pop()!;
        this.future.push(entry);
        return entry;
    }

    public redo(): HistoryEntry | null {
        if (this.future.length === 0) return null;
        const entry = this.future.pop()!;
        this.past.push(entry);
        return entry;
    }

    public clear() {
        this.past = [];
        this.future = [];
    }
}
