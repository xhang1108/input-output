import { Transaction } from './types';

export interface HistoryEntry {
    do: Transaction;
    undo: Transaction;
}

export class HistoryManager {
    private past: HistoryEntry[] = [];
    private future: HistoryEntry[] = [];
    private readonly MAX_HISTORY = 50;

    public push(entry: HistoryEntry) {
        // If we are recording a new action, future is cleared
        this.future = [];
        this.past.push(entry);

        if (this.past.length > this.MAX_HISTORY) {
            this.past.shift();
        }
        console.log(`[History] Pushed. Past: ${this.past.length}, Future: ${this.future.length}`);
    }

    public undo(): HistoryEntry | null {
        if (this.past.length === 0) return null;

        const entry = this.past.pop()!;
        this.future.push(entry);
        console.log(`[History] Undo. Past: ${this.past.length}, Future: ${this.future.length}`);
        return entry;
    }

    public redo(): HistoryEntry | null {
        if (this.future.length === 0) return null;

        const entry = this.future.pop()!;
        this.past.push(entry);
        console.log(`[History] Redo. Past: ${this.past.length}, Future: ${this.future.length}`);
        return entry;
    }

    public clear() {
        this.past = [];
        this.future = [];
    }
}
