import { nanoid } from 'nanoid';
import { Serializer, ProjectData } from '../engine/Serializer';
import { Brain } from '../engine/Brain';

// ─── Types ────────────────────────────────────────────

export interface SaveSlotMeta {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    nodeCount: number;
    edgeCount: number;
    version: string;
}

export interface SaveSlot {
    meta: SaveSlotMeta;
    data: string; // LZString compressed ProjectData
}

// ─── Constants ────────────────────────────────────────

const INDEX_KEY = 'calctopus-saves-index';
const SLOT_PREFIX = 'calctopus-save-';
const MAX_SLOTS = 20;

// ─── SaveManager (Static Service) ─────────────────────

export class SaveManager {

    /**
     * List all saved project metadata, sorted by updatedAt descending.
     */
    static list(): SaveSlotMeta[] {
        try {
            const raw = localStorage.getItem(INDEX_KEY);
            if (!raw) return [];
            const index: SaveSlotMeta[] = JSON.parse(raw);
            return index.sort((a, b) => b.updatedAt - a.updatedAt);
        } catch {
            console.error('[SaveManager] Failed to read index');
            return [];
        }
    }

    /**
     * Save the current project state to a slot.
     * If slotId is provided & exists, overwrites it. Otherwise creates a new slot.
     * Returns the slot id.
     */
    static save(
        name: string,
        brain: Brain,
        settings: Record<string, unknown>,
        slotId?: string
    ): string {
        const index = this.list();

        // Check capacity on new slot
        if (!slotId && index.length >= MAX_SLOTS) {
            throw new Error(`Save limit reached (max ${MAX_SLOTS}). Delete an old save first.`);
        }

        const id = slotId ?? nanoid(10);
        const encoded = Serializer.serialize(brain, settings);

        // Extract metadata from brain state
        const graph = brain.toInjectable();
        const now = Date.now();

        const meta: SaveSlotMeta = {
            id,
            name,
            createdAt: slotId
                ? (index.find(s => s.id === slotId)?.createdAt ?? now)
                : now,
            updatedAt: now,
            nodeCount: graph.nodes.length,
            edgeCount: graph.edges.length,
            version: Serializer.VERSION,
        };

        // Persist the data blob
        localStorage.setItem(SLOT_PREFIX + id, encoded);

        // Update index
        const newIndex = index.filter(s => s.id !== id);
        newIndex.push(meta);
        localStorage.setItem(INDEX_KEY, JSON.stringify(newIndex));

        return id;
    }

    /**
     * Load a project from a saved slot.
     */
    static load(slotId: string): ProjectData | null {
        const encoded = localStorage.getItem(SLOT_PREFIX + slotId);
        if (!encoded) {
            console.error(`[SaveManager] No data found for slot ${slotId}`);
            return null;
        }
        return Serializer.deserialize(encoded);
    }

    /**
     * Delete a save slot.
     */
    static delete(slotId: string): void {
        localStorage.removeItem(SLOT_PREFIX + slotId);

        const index = this.list().filter(s => s.id !== slotId);
        localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }

    /**
     * Rename a save slot.
     */
    static rename(slotId: string, newName: string): void {
        const index = this.list();
        const slot = index.find(s => s.id === slotId);
        if (!slot) return;

        slot.name = newName;
        slot.updatedAt = Date.now();
        localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }

    /**
     * Get metadata for a specific slot.
     */
    static getMeta(slotId: string): SaveSlotMeta | undefined {
        return this.list().find(s => s.id === slotId);
    }

    /**
     * Migrate the legacy autosave into the new system, if it exists.
     * Called once on first app load.
     */
    static migrateLegacy(): string | null {
        const legacy = localStorage.getItem('calctopus-autocsave');
        if (!legacy) return null;

        const data = Serializer.deserialize(legacy);
        if (!data) return null;

        // Create a new slot from the legacy autosave
        const id = nanoid(10);
        const now = Date.now();
        const meta: SaveSlotMeta = {
            id,
            name: 'Recovered Project',
            createdAt: now,
            updatedAt: now,
            nodeCount: data.graph?.nodes?.length ?? 0,
            edgeCount: data.graph?.edges?.length ?? 0,
            version: data.version ?? Serializer.VERSION,
        };

        localStorage.setItem(SLOT_PREFIX + id, legacy);

        const index = this.list();
        index.push(meta);
        localStorage.setItem(INDEX_KEY, JSON.stringify(index));

        // Remove legacy keys
        localStorage.removeItem('calctopus-autocsave');
        localStorage.removeItem('calctopus-flow-storage-v1');

        return id;
    }
}
