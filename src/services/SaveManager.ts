import { nanoid } from 'nanoid';
import { v7 as uuidv7 } from 'uuid';
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

const INDEX_KEY = 'Input-Output-saves-index';
const SLOT_PREFIX = 'Input-Output-save-';
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

        const id = slotId ?? uuidv7();
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
        const encoded = this.getRawData(slotId);
        if (!encoded) return null;
        return Serializer.deserialize(encoded);
    }

    /**
     * Get the raw encoded data string for a slot.
     */
    static getRawData(slotId: string): string | null {
        return localStorage.getItem(SLOT_PREFIX + slotId);
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
     * Transfer a slot between storage types (Local <-> Cloud)
     * This moves the data in local storage and updates the index.
     */
    static transferSlot(oldId: string, newId: string, meta?: Partial<SaveSlotMeta>): void {
        const encoded = localStorage.getItem(SLOT_PREFIX + oldId);
        if (!encoded) return;

        // Move the data
        localStorage.setItem(SLOT_PREFIX + newId, encoded);
        localStorage.removeItem(SLOT_PREFIX + oldId);

        // Update index
        const index = this.list();
        const slotIndex = index.findIndex(s => s.id === oldId);
        
        if (slotIndex !== -1) {
            index[slotIndex].id = newId;
            if (meta) {
                if (meta.name) index[slotIndex].name = meta.name;
                if (meta.updatedAt) index[slotIndex].updatedAt = meta.updatedAt;
                if (meta.createdAt) index[slotIndex].createdAt = meta.createdAt;
            }
        } else {
            // New local entry (e.g. cloud-only project being downloaded)
            index.push({
                id: newId,
                name: meta?.name || "Untitled Project",
                updatedAt: meta?.updatedAt || Date.now(),
                createdAt: meta?.createdAt || Date.now(),
                nodeCount: meta?.nodeCount || 0,
                edgeCount: meta?.edgeCount || 0,
                version: meta?.version || "2.0"
            });
        }
        
        localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }

    /**
     * Migrate the legacy autosave into the new system, if it exists.
     * Called once on first app load.
     */
    static migrateLegacy(): string | null {
        const legacy = localStorage.getItem('Input-Output-autocsave');
        if (!legacy) return null;

        const data = Serializer.deserialize(legacy);
        if (!data) return null;

        // Create a new slot from the legacy autosave
        const id = uuidv7();
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
        localStorage.removeItem('Input-Output-autocsave');
        localStorage.removeItem('Input-Output-flow-storage-v1');

        return id;
    }
}

