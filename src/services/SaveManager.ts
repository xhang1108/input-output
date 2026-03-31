
import { Serializer } from '../engine/Serializer';
import { Brain } from '../engine/Brain';
import { ProjectData, InjectableGraph } from '../engine/types';

// ─── Types ────────────────────────────────────────────

export interface SaveSlotMeta {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    nodeCount: number;
    edgeCount: number;
    version: string;
    visibility?: 'private' | 'public';
    syncStatus?: 'synced' | 'pending';
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

        const id = slotId ?? crypto.randomUUID();
        const graph = brain.toInjectable();
        const projectData: ProjectData = {
            version: Serializer.VERSION,
            mathPrecision: 64, 
            settings: settings as any,
            nodes: graph.nodes,
            edges: graph.edges
        };
        const encoded = Serializer.serialize(projectData);

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
            syncStatus: slotId 
                ? (index.find(s => s.id === slotId)?.syncStatus)
                : undefined
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
     * Save node data directly from an encoded string. [V3.0 Optimization]
     * Bypasses full engine re-serialization.
     */
    public static saveFromRaw(
        name: string,
        encoded: string,
        settings: Record<string, unknown>,
        slotId?: string
    ): string {
        const index = this.list();
        if (!slotId && index.length >= MAX_SLOTS) {
            throw new Error(`Save limit reached (max ${MAX_SLOTS}). Delete an old save first.`);
        }

        const id = slotId ?? crypto.randomUUID();
        const now = Date.now();
        
        // Decompress briefly to capture node/edge counts for indexing
        const data = Serializer.deserialize(encoded);
        const nodeCount = data?.nodes?.length ?? 0;
        const edgeCount = data?.edges?.length ?? 0;

        const meta: SaveSlotMeta = {
            id,
            name,
            createdAt: slotId
                ? (index.find(s => s.id === slotId)?.createdAt ?? now)
                : now,
            updatedAt: now,
            nodeCount,
            edgeCount,
            version: Serializer.VERSION,
            syncStatus: slotId 
                ? (index.find(s => s.id === slotId)?.syncStatus)
                : undefined
        };

        localStorage.setItem(SLOT_PREFIX + id, encoded);
        const newIndex = index.filter(s => s.id !== id);
        newIndex.push(meta);
        localStorage.setItem(INDEX_KEY, JSON.stringify(newIndex));

        return id;
    }

    /**
     * Efficiently save a template directly from a parsed graph, bypassing Engine overhead.
     * Used for initial payload ingestion.
     */
    static saveTemplate(name: string, graph: InjectableGraph): string {
        const id = crypto.randomUUID();
        const now = Date.now();
        const data: ProjectData = {
            version: Serializer.VERSION,
            mathPrecision: 64, 
            settings: {},
            ...graph
        };

        const encoded = Serializer.serializeData(data);
        const meta: SaveSlotMeta = {
            id,
            name,
            createdAt: now,
            updatedAt: now,
            nodeCount: graph.nodes.length,
            edgeCount: graph.edges.length,
            version: Serializer.VERSION,
            visibility: 'private'
        };

        localStorage.setItem(SLOT_PREFIX + id, encoded);
        
        const index = this.list();
        index.push(meta);
        localStorage.setItem(INDEX_KEY, JSON.stringify(index));

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
     * Set raw encoded data string for a slot (Internal use for transfer/migration).
     */
    static putRawData(slotId: string, data: string): void {
        localStorage.setItem(SLOT_PREFIX + slotId, data);
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
        this.updateMeta(slotId, { name: newName });
    }

    /**
     * Update specific metadata fields for a slot.
     */
    static updateMeta(slotId: string, updates: Partial<SaveSlotMeta>): void {
        const index = this.list();
        const slotIdx = index.findIndex(s => s.id === slotId);
        if (slotIdx === -1) return;

        index[slotIdx] = { ...index[slotIdx], ...updates, updatedAt: Date.now() };
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
                version: meta?.version || "2.0",
                visibility: meta?.visibility
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
        const id = crypto.randomUUID();
        const now = Date.now();
        const meta: SaveSlotMeta = {
            id,
            name: 'Recovered Project',
            createdAt: now,
            updatedAt: now,
            nodeCount: data.nodes?.length ?? 0,
            edgeCount: data.edges?.length ?? 0,
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

    /**
     * Purge all cloud-cached data from local storage.
     * Called on logout to prevent offline access to cloud projects.
     */
    static purgeCloudCache(): void {
        const index = this.list();
        // ONLY purge projects that are NOT pending sync
        const purgeableIds = index
            .filter(s => s.id.startsWith('cloud:') && s.syncStatus !== 'pending')
            .map(s => s.id);
            
        purgeableIds.forEach(id => {
            localStorage.removeItem(SLOT_PREFIX + id);
        });
        
        const newIndex = index.filter(s => !s.id.startsWith('cloud:') || s.syncStatus === 'pending');
        localStorage.setItem(INDEX_KEY, JSON.stringify(newIndex));
        
        console.log(`[SaveManager] Purged ${purgeableIds.length} cloud projects from cache. Preserved pending ones.`);
    }
}
