'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from "next-auth/react";

import {
    Plus, Trash2, Pencil, Check, X,
    Box, GitBranch, Clock, Cloud, HardDrive,
    ArrowDownToLine, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { SaveManager, SaveSlotMeta } from '../../services/SaveManager';
import { SharePopover } from './SharePopover';

// ─── Helper ───────────────────────────────────────────

const getCanonicalId = (id: string) => id.replace(/^(cloud:)+/gi, '');

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
}

// ─── SaveSlotCard ─────────────────────────────────────

function SaveSlotCard({
    meta,
    isCloud = false,
    onOpen,
    onDelete,
    onRename,
    onTransfer,
    canSyncToCloud = false,
    isTransferring = false,
    loading = false,
    onVisibilityChange,
    activeSlotId,
    setActiveSlotId,
}: {
    meta: SaveSlotMeta;
    isCloud?: boolean;
    onOpen: () => void;
    onDelete: () => void;
    onRename: (name: string) => void;
    onTransfer: (toCloud: boolean) => void;
    canSyncToCloud?: boolean;
    isTransferring?: boolean;
    loading?: boolean;
    onVisibilityChange?: (visibility: 'private' | 'public') => void;
    activeSlotId?: string | null;
    setActiveSlotId?: (id: string | null) => void;
}) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [nameInput, setNameInput] = useState(meta.name);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const submitRename = useCallback(() => {
        const trimmed = nameInput.trim();
        if (trimmed && trimmed !== meta.name) {
            onRename(trimmed);
        }
        setIsRenaming(false);
    }, [nameInput, meta.name, onRename]);

    // Handle exclusive interaction: submit rename if another card becomes active
    useEffect(() => {
        if (activeSlotId !== meta.id && isRenaming) {
            submitRename();
        }
    }, [activeSlotId, meta.id, isRenaming, submitRename]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`group relative flex flex-col border bg-surface-dim transition-all duration-300 rounded-2xl
                       ${meta.syncStatus === 'pending'
                    ? 'border-warning/50 shadow-[0_0_20px_-3px_hsla(38,92%,55%,0.15)]'
                    : isCloud ? 'border-surface-dim shadow-[0_0_15px_-3px_hsla(217,91%,60%,0.1)]' : 'border-surface-dim'}
                       ${loading ? 'opacity-70 pointer-events-none' : 'hover:border-surface-light hover:shadow-xl hover:-translate-y-1 hover:z-60 focus-within:z-60 cursor-pointer'} 
                       ${isTransferring ? 'animate-pulse' : ''}`}
            whileTap={{ scale: 0.97, opacity: 0.8 }}
            onClick={() => !loading && onOpen()}
        >
            {/* ── Type Badge ── */}
            <div className={`absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${meta.syncStatus === 'pending'
                ? 'bg-warning/10 text-warning border-warning/20'
                : isCloud
                    ? 'bg-cloud/10 text-text-cloud border-cloud/20'
                    : 'bg-surface-light/80 text-text-muted border-border-dim'}`}>
                {isTransferring ? (
                    <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                    meta.syncStatus === 'pending' ? <AlertTriangle className="w-2.5 h-2.5" /> :
                        isCloud ? <Cloud className="w-2.5 h-2.5" /> : <HardDrive className="w-2.5 h-2.5" />
                )}
                {isTransferring ? 'Syncing...' : (meta.syncStatus === 'pending' ? 'Pending' : isCloud ? 'Cloud' : 'Local')}
            </div>

            {/* Visual Header / Thumbnail */}
            <div className={`aspect-16/10 relative flex items-center justify-center overflow-hidden rounded-t-[calc(1rem-1px)]
                           ${isCloud ? 'bg-cloud/5' : 'bg-surface-base/40 border-b border-white/5'}`}>

                {loading ? (
                    <div className="flex flex-col items-center gap-3">
                        <motion.img 
                            src="/logo.webp" 
                            alt="Loading" 
                            className="w-10 h-10 object-contain"
                            animate={{ 
                                scale: [1, 1.15, 1],
                                opacity: [0.7, 1, 0.7]
                            }}
                            transition={{ 
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />
                        <span className="text-[10px] uppercase tracking-widest text-unit font-bold animate-pulse">Initialising</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                            <span className={`text-3xl font-bold ${meta.syncStatus === 'pending' ? 'text-warning/70' : isCloud ? 'text-text-cloud/70' : 'text-text-muted'}`}>{meta.nodeCount}</span>
                            <span className={`text-[10px] uppercase tracking-wider ${meta.syncStatus === 'pending' ? 'text-warning/50' : isCloud ? 'text-cloud/50' : 'text-zinc-600'}`}>nodes</span>
                        </div>
                        <div className={`w-px h-10 ${meta.syncStatus === 'pending' ? 'bg-warning/30' : isCloud ? 'bg-cloud/30' : 'bg-surface-light'}`} />
                        <div className="flex flex-col items-center">
                            <span className={`text-3xl font-bold ${meta.syncStatus === 'pending' ? 'text-warning/70' : isCloud ? 'text-text-cloud/70' : 'text-text-muted'}`}>{meta.edgeCount}</span>
                            <span className={`text-[10px] uppercase tracking-wider ${meta.syncStatus === 'pending' ? 'text-warning/50' : isCloud ? 'text-cloud/50' : 'text-zinc-600'}`}>edges</span>
                        </div>
                    </div>
                )}

                {/* Decorative corner dots */}
                <div className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full ${isCloud ? 'bg-cloud/20' : 'bg-surface-light'}`} />
                <div className={`absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full ${isCloud ? 'bg-cloud/20' : 'bg-surface-light'}`} />
                <div className={`absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full ${isCloud ? 'bg-cloud/20' : 'bg-surface-light'}`} />

                {/* Dynamic Status Badge (Pending Sync) */}
                {isCloud && !loading && meta.syncStatus === 'pending' && (
                    <div className="absolute top-2 right-2 animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning/20 text-warning border border-warning/30 text-[9px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Pending Sync
                        </div>
                    </div>
                )}
            </div>

            {/* ── Info Section ── */}
            <div className="p-3 space-y-2">
                {/* Title Row */}
                <div className="flex items-center justify-between min-h-[32px] gap-2">
                    {isRenaming ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                            <input
                                autoFocus
                                value={nameInput}
                                onChange={e => setNameInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        submitRename();
                                    }
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setIsRenaming(false);
                                    }
                                }}
                                className="flex-1 min-w-0 bg-surface-light border border-border-dim rounded-sm px-2 py-0.5 text-sm text-zinc-100
                                           outline-none focus:border-unit"
                            />
                            <div className="flex items-center gap-0.5">
                                <button onClick={submitRename} className="p-1 text-success hover:text-success/80 transition-colors">
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setIsRenaming(false)} className="p-1 text-text-muted hover:text-zinc-300 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <span className={`text-sm font-semibold truncate flex-1 ${meta.syncStatus === 'pending' ? 'text-warning' : 'text-zinc-200'}`}>{meta.name}</span>
                    )}
                </div>

                {/* Meta Row */}
                <div className="flex items-center gap-3 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1 ml-auto">
                        <Clock className="w-3 h-3" /> {timeAgo(meta.updatedAt)}
                    </span>
                </div>

                {/* Action Row */}
                <div
                    className="flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    onClick={e => e.stopPropagation()}
                >

                    {isCloud ? (
                        <button
                            onClick={() => onTransfer(false)}
                            className="p-1.5 rounded-sm text-text-muted hover:text-success hover:bg-success/10 transition-colors cursor-pointer"
                            title="Make Local Only"
                        >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        canSyncToCloud && (
                            <button
                                onClick={() => onTransfer(true)}
                                className="p-1.5 rounded-sm text-text-muted hover:text-text-cloud hover:bg-cloud/10 transition-colors cursor-pointer"
                                title="Sync to Cloud"
                            >
                                <Cloud className="w-3.5 h-3.5" />
                            </button>
                        )
                    )}

                    <button
                        onClick={() => { 
                            setActiveSlotId?.(meta.id);
                            if (isRenaming) submitRename();
                            else { setNameInput(meta.name); setIsRenaming(true); }
                        }}
                        className={`p-1.5 rounded-sm transition-all cursor-pointer ${isRenaming ? 'text-success hover:text-success/80 bg-success/10' : 'text-text-muted hover:text-zinc-300 hover:bg-surface-light'}`}
                        title={isRenaming ? "Save changes" : "Rename"}
                    >
                        {isRenaming ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                    </button>
                    <div className="relative ml-auto flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {confirmDelete ? (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-30 p-1 bg-surface-base border border-border-dim rounded-md shadow-2xl flex items-center gap-1.5 animate-in zoom-in-95 fade-in duration-150">
                                <button
                                    onClick={onDelete}
                                    className="text-[9px] px-2 py-1 rounded-[4px] bg-danger/20 text-danger hover:bg-danger/30 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    Confirm
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="p-1 text-text-muted hover:text-zinc-300 transition-colors cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <>
                                {isCloud && (
                                    <SharePopover
                                        projectId={meta.id}
                                        visibility={meta.visibility || 'private'}
                                        onVisibilityChange={onVisibilityChange}
                                        activeSlotId={activeSlotId}
                                        onOpen={() => setActiveSlotId?.(meta.id)}
                                    />
                                )}
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    className="p-1.5 rounded-sm text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                    title="Delete"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ─── New Project Card ─────────────────────────────────

function NewProjectCard({ onClick, isCloud = false, disabled = false, description, loading = false }: { onClick: () => void; isCloud?: boolean; disabled?: boolean; description?: string; loading?: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            whileTap={{ scale: 0.94, opacity: 0.7 }}
            onClick={() => !disabled && !loading && onClick()}
            className={`relative flex flex-col items-center justify-center border-2 border-dashed
                       rounded-2xl min-h-[220px] transition-all duration-200 group overflow-hidden
                       ${(disabled || loading) ? 'opacity-40 cursor-not-allowed border-border-dim' : 'cursor-pointer'}
                       ${isCloud
                    ? 'bg-surface-dim border-cloud/30 hover:border-cloud/50 hover:bg-surface-light shadow-[0_0_15px_-3px_hsla(217,91%,60%,0.05)]'
                    : 'bg-surface-dim border-surface-light hover:border-unit/50 hover:bg-surface-light'}`}
        >
            <div className="absolute inset-x-0 top-0 h-1/2 bg-surface-base/30 border-b border-dashed border-white/5 pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center pt-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors duration-200
                              ${isCloud
                        ? 'bg-cloud/20 text-text-cloud group-hover:bg-cloud/20'
                        : 'bg-surface-light text-text-muted group-hover:bg-unit/20 group-hover:text-unit'}`}>
                    {loading ? (
                        <motion.img 
                            src="/logo.webp" 
                            alt="Loading" 
                            className="w-8 h-8 object-contain"
                            animate={{ 
                                scale: [1, 1.1, 1],
                                opacity: [0.5, 1, 0.5]
                            }}
                            transition={{ 
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />
                    ) : (
                        isCloud ? <Cloud className="w-6 h-6" /> : <Plus className="w-6 h-6" />
                    )}
                </div>
                <div className="flex flex-col items-center text-center px-4">
                    <span className={`text-sm font-bold uppercase tracking-widest ${isCloud ? 'text-text-cloud' : 'text-text-dim group-hover:text-zinc-200'}`}>
                        {loading ? 'Initialising...' : 'New Project'}
                    </span>
                    <span className="text-[10px] text-zinc-600 mt-1">
                        {loading ? 'Please wait' : (description || (isCloud ? 'Synced with D1' : 'Saved in Browser'))}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

// ─── ProjectLoadScreen ────────────────────────────────

interface ProjectLoadScreenProps {
    onOpen: (slotId: string) => void;
    onNewProject: (slotId?: string) => void;
}

export function ProjectLoadScreen({ onOpen, onNewProject }: ProjectLoadScreenProps) {
    const { data: session } = useSession();
    const [slots, setSlots] = useState<SaveSlotMeta[]>([]);
    const [cloudSlots, setCloudSlots] = useState<SaveSlotMeta[]>([]);
    const [isLoadingCloud, setIsLoadingCloud] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [transferringIds, setTransferringIds] = useState<Record<string, boolean>>({});
    const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

    const refreshLocal = useCallback(() => {
        setSlots(SaveManager.list());
    }, []);

    // Initial load + legacy migration
    useEffect(() => {
        SaveManager.migrateLegacy();
        refreshLocal();

        const handleUpdate = () => refreshLocal();
        window.addEventListener('local-projects-updated', handleUpdate);
        return () => window.removeEventListener('local-projects-updated', handleUpdate);
    }, [refreshLocal]);

    // Fetch for cloud graphs API
    const loadCloudGraphs = useCallback(async () => {
        if (!session) return;
        setIsLoadingCloud(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const res = await fetch('/api/graphs', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error("Failed to load cloud graphs");
            const data = await res.json();

            const mappedSlots: SaveSlotMeta[] = data.map((g: any) => {
                const rawId = g.id || '';
                const decodedId = rawId.includes('%') ? decodeURIComponent(rawId) : rawId;

                const canonical = getCanonicalId(decodedId);
                return {
                    id: `cloud:${canonical}`,
                    name: g.title,
                    createdAt: new Date(g.createdAt).getTime(),
                    updatedAt: new Date(g.updatedAt).getTime(),
                    nodeCount: g.nodeCount || 0,
                    edgeCount: g.edgeCount || 0,
                    version: "2.0",
                    visibility: g.visibility || 'private'
                };
            });

            setCloudSlots(JSON.parse(JSON.stringify(mappedSlots)));
        } catch (e: any) {
            console.error(e);
        } finally {
            clearTimeout(timeoutId);
            setIsLoadingCloud(false);
        }
    }, [session]);

    useEffect(() => {
        if (session) {
            loadCloudGraphs();
        } else {
            // Logout: Clear cloud-prefixed metadata from local storage
            SaveManager.purgeCloudCache();
            refreshLocal();
            setCloudSlots([]);
        }
    }, [session, loadCloudGraphs, refreshLocal]);

    const handleDelete = async (id: string, isCloud: boolean) => {
        if (isCloud) {
            try {
                const apiId = getCanonicalId(id);
                const res = await fetch(`/api/graphs/${apiId}`, { method: 'DELETE' });

                // If it's 404, it means it's already gone from the server, so we consider it a success
                if (!res.ok && res.status !== 404) {
                    throw new Error("Failed to delete cloud graph");
                }

                // IMPORTANT: Always purge the local backup/cache too to prevent it from "re-appearing"
                // due to the unified merge logic in ProjectLoadScreen.
                SaveManager.delete(id);

                loadCloudGraphs();
                refreshLocal(); // Refresh local list to reflect the deletion of the backup
            } catch (e) {
                console.error(e);
                toast.error("Failed to delete cloud graph");
            }
        } else {
            SaveManager.delete(id);
            refreshLocal();
        }
    };

    const handleRename = async (id: string, name: string, isCloud: boolean, visibility?: 'private' | 'public') => {
        // Optimistic UI Update
        if (isCloud) {
            setCloudSlots(prev => prev.map(s => s.id === id ? { ...s, name, visibility: visibility || s.visibility } : s));
        } else {
            setSlots(prev => prev.map(s => s.id === id ? { ...s, name } : s));
        }

        if (isCloud) {
            try {
                const apiId = getCanonicalId(id);
                const res = await fetch(`/api/graphs/${apiId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: name, visibility })
                });
                if (!res.ok) {
                    // Revert on error
                    loadCloudGraphs();
                    throw new Error("Failed to update cloud graph");
                }

                // If title changed, we might want to sync with local storage if it's cached
                const originalMeta = cloudSlots.find(s => s.id === id);
                if (originalMeta?.name !== name) {
                    SaveManager.rename(id, name);
                }
            } catch (e) {
                console.error(e);
                toast.error("Failed to rename cloud graph");
                loadCloudGraphs(); // Sync back from server
            }
        } else {
            SaveManager.rename(id, name);
            refreshLocal();
        }
    };

    const handleTransfer = async (id: string, toCloud: boolean) => {
        const canonicalId = getCanonicalId(id);

        if (toCloud && !session) {
            toast.error("Please sign in to sync to cloud");
            return;
        }

        // Optimistic Start
        setTransferringIds(prev => ({ ...prev, [canonicalId]: true }));

        try {
            // Data Lookup: Try Cloud-prefixed first, then Canonical
            let rawData = SaveManager.getRawData(`cloud:${canonicalId}`) || SaveManager.getRawData(canonicalId);

            const meta = SaveManager.getMeta(id) || SaveManager.getMeta(canonicalId);
            const title = meta?.name || "Untitled Project";

            // If we don't have the data locally but it's a cloud project, we MUST fetch it from the server
            if (!rawData) {
                if (id.startsWith('cloud:') || cloudSlots.some(s => getCanonicalId(s.id) === canonicalId)) {
                    // API expects the raw UUID, the [id] dynamic route handles it
                    const res = await fetch(`/api/graphs/${canonicalId}`);
                    if (!res.ok) throw new Error(`Could not download data (HTTP ${res.status})`);
                    const cloudData = await res.json();
                    rawData = cloudData.payload;
                }
            }

            if (!rawData) throw new Error("Could not find project data locally or on cloud");

            if (toCloud) {
                // Actual Network Sync: Create on Cloud
                const res = await fetch('/api/graphs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payload: rawData,
                        title,
                        id: canonicalId,
                        createdAt: meta?.createdAt || Date.now(),
                        updatedAt: meta?.updatedAt || Date.now(),
                        nodeCount: meta?.nodeCount || 0,
                        edgeCount: meta?.edgeCount || 0
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || "Cloud sync failed");
                }
                // SUCCESS: Cloud is confirmed
                loadCloudGraphs(); // Refresh dashboard list

                // CRITICAL: Use correct storage ID with prefix
                const actualId = getCanonicalId(id); // Ensure we have the canonical ID for the local meta
                const storageId = `cloud:${actualId}`;
                SaveManager.updateMeta(storageId, { syncStatus: 'synced' });
            } else {
                // Actual Network Sync: Remove from Cloud
                const apiId = canonicalId;
                const res = await fetch(`/api/graphs/${apiId}`, { method: 'DELETE' });
                if (!res.ok) {
                    const err = await res.json();
                    console.warn("Cloud deletion failed, but proceeding with local transfer:", err.error);
                } else {
                    // Optimistic Removal: Remove from cloudSlots immediately so UI flips to Local
                    setCloudSlots(prev => prev.filter(s => getCanonicalId(s.id) !== canonicalId));
                }
            }

            const newId = toCloud ? `cloud:${canonicalId}` : canonicalId;

            // If data was missing locally but fetched from cloud, store it temporarily so transferSlot works
            if (!SaveManager.getRawData(id) && !SaveManager.getRawData(`cloud:${canonicalId}`)) {
                SaveManager.putRawData(id, rawData);
            }

            SaveManager.transferSlot(id, newId, meta || undefined);

            toast.success(toCloud ? "Synced to cloud" : "Transferred to local", {
                description: toCloud ? "Project state has been backed up on the server." : "Project removed from cloud, stored locally."
            });

            // Trigger actual logic
            await Promise.all([
                refreshLocal(),
                session ? loadCloudGraphs() : Promise.resolve()
            ]);
        } catch (e: any) {
            console.error("Transfer error:", e);
            toast.error("Transfer failed", {
                description: e.message || "An unexpected error occurred during storage transfer."
            });
        } finally {
            // Little delay for UX feel, prevent flickering
            setTimeout(() => {
                setTransferringIds(prev => {
                    const next = { ...prev };
                    delete next[canonicalId];
                    return next;
                });
            }, 600);
        }
    };

    // Unified & Deduplicated List
    // We merge by Canonical ID to ensure 1:1 mapping and no disappearing acts
    const projectMap = new Map<string, SaveSlotMeta & { isCloud: boolean }>();

    slots.forEach(s => {
        const isCloudPrefix = s.id.startsWith('cloud:');

        // Hide cloud projects from local list when logged out
        if (!session && isCloudPrefix) return;

        const cid = getCanonicalId(s.id);
        projectMap.set(cid, { ...s, isCloud: isCloudPrefix });
    });

    // Merge Cloud (overwrites local entries if same CID exists)
    cloudSlots.forEach(s => {
        const cid = getCanonicalId(s.id);
        const existing = projectMap.get(cid);
        // Prioritize cloud status, but keep meta if cloud one is empty-ish
        projectMap.set(cid, {
            ...(existing || s),
            id: s.id,
            isCloud: true,
            visibility: s.visibility || (existing?.visibility as 'private' | 'public'),
            // Keep the best metadata
            updatedAt: Math.max(s.updatedAt, existing?.updatedAt || 0),
            nodeCount: s.nodeCount || existing?.nodeCount || 0,
            edgeCount: s.edgeCount || existing?.edgeCount || 0,
            syncStatus: existing?.syncStatus || s.syncStatus
        });
    });

    const allProjects = Array.from(projectMap.values()).sort((a, b) => {
        // Multi-stage stable sort
        if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
        if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
        return a.name.localeCompare(b.name);
    });

    // Cloud-First Logic
    const canCreateCloud = !!session && cloudSlots.length < 20;

    const handleNewProjectLogic = () => {
        const id = crypto.randomUUID();
        setLoadingId('new-project');
        if (canCreateCloud) {
            onNewProject(`cloud:${id}?new=1`);
            toast.info("Initialising cloud-synced project");
        } else {
            onNewProject(id);
            if (!session) toast.info("Creating Local project (Signed out)");
            else if (cloudSlots.length >= 20) toast.warning("Cloud limit reached, creating Local");
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-auto bg-transparent relative">
            {isLoadingCloud && (
                <div className="absolute top-6 right-8 flex items-center gap-2 px-3 py-1.5 bg-cloud/10 border border-cloud/20 rounded-full z-20">
                    <motion.img 
                        src="/logo.webp" 
                        alt="Syncing" 
                        className="w-3 h-3 object-contain"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    />
                    <span className="text-[10px] font-bold text-text-cloud uppercase tracking-widest">Syncing Cloud</span>
                </div>
            )}

            <main className="flex-1 px-8 py-20">
                <AutoSyncManager allProjects={allProjects} session={session} refreshLocal={refreshLocal} />
                <div className="max-w-6xl mx-auto space-y-12">

                    {/* Header Section */}
                    <div className="flex flex-col items-center text-center space-y-2">
                        <h1 className="text-3xl font-black tracking-tighter text-white">DASHBOARD</h1>
                        <p className="text-text-muted text-sm max-w-md">Manage your local and cloud-synced projects in one place.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {/* New Project Options */}
                        <div className="grid grid-cols-1 gap-4 lg:contents">
                            <NewProjectCard
                                onClick={handleNewProjectLogic}
                                isCloud={canCreateCloud}
                                loading={loadingId === 'new-project'}
                                description={canCreateCloud ? "Auto-synced to Cloud" : (session ? "Cloud limit reached" : "Sign in for Cloud storage")}
                            />
                        </div>

                        {/* Project History */}
                        <AnimatePresence>
                            {allProjects.map(meta => {
                                const cid = getCanonicalId(meta.id);
                                const isTransferring = !!transferringIds[cid];
                                const isLoading = loadingId === meta.id;
                                // Visually override cloud status if in transition
                                const isCloud = meta.isCloud;

                                return (
                                    <SaveSlotCard
                                        key={cid}
                                        meta={meta}
                                        isCloud={isCloud}
                                        isTransferring={isTransferring}
                                        loading={isLoading}
                                        onOpen={() => {
                                            setLoadingId(meta.id);
                                            onOpen(meta.id);
                                        }}
                                        onDelete={() => handleDelete(meta.id, isCloud)}
                                        onRename={(name) => handleRename(meta.id, name, isCloud)}
                                        onTransfer={(toCloud) => handleTransfer(meta.id, toCloud)}
                                        onVisibilityChange={(newVisibility) => handleRename(meta.id, meta.name, true, newVisibility)}
                                        canSyncToCloud={!!session && cloudSlots.length < 20}
                                        activeSlotId={activeSlotId}
                                        setActiveSlotId={setActiveSlotId}
                                    />
                                );
                            })}
                        </AnimatePresence>
                    </div>

                    {allProjects.length === 0 && !isLoadingCloud && (
                        <div className="py-20 text-center space-y-4">
                            <div className="w-16 h-16 bg-surface-base rounded-full flex items-center justify-center mx-auto border border-border-dim">
                                <Box className="w-8 h-8 text-zinc-700" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-text-dim font-medium">No projects yet</h3>
                                <p className="text-sm text-zinc-600">Start by creating a local or cloud-synced project above.</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

/**
 * Internal component to handle background sync logic without polluting main render
 */
function AutoSyncManager({ allProjects, session, refreshLocal }: { allProjects: any[], session: any, refreshLocal: () => void }) {
    useEffect(() => {
        if (!session || typeof navigator === 'undefined' || !navigator.onLine) return;

        const pendingCloud = allProjects.filter(p => p.isCloud && p.syncStatus === 'pending');
        if (pendingCloud.length === 0) return;

        // Debounce to prevent rapid fire
        const timer = setTimeout(() => {
            console.log(`[AutoSync] Found ${pendingCloud.length} projects pending sync. Retrying...`);

            pendingCloud.forEach(async (p) => {
                try {
                    const rawData = SaveManager.getRawData(p.id);
                    if (!rawData) return;

                    // Clean the ID for API (remove 'cloud:' prefix if present)
                    const cid = p.id.replace(/^cloud:/, '');
                    const fetchOptions = {
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            payload: rawData,
                            title: p.name,
                            id: cid, // Explicitly provide ID for POST
                            nodeCount: p.nodeCount,
                            edgeCount: p.edgeCount,
                            visibility: p.visibility || 'private'
                        })
                    };

                    let res = await fetch(`/api/graphs/${cid}`, {
                        method: 'PUT',
                        ...fetchOptions
                    });

                    // Fallback to POST if project doesn't exist on server yet (404)
                    if (res.status === 404) {
                        console.log(`[AutoSync] Project ${cid} not found on server (likely offline created). Attempting POST.`);
                        res = await fetch(`/api/graphs`, {
                            method: 'POST',
                            ...fetchOptions
                        });
                    }

                    if (res.ok) {
                        SaveManager.updateMeta(p.id, { syncStatus: 'synced' });
                        refreshLocal();
                        toast.success(`Synced "${p.name}" to Cloud ☁️`);
                    } else {
                        const err = await res.json().catch(() => ({ error: 'Sync failed' }));

                        if (err.error?.includes('Graph limit reached')) {
                            toast.error('Cloud Space Full (10/10)', {
                                description: `Background sync failed for "${p.name}". Please free up some cloud space.`,
                                duration: 8000
                            });
                        }

                        console.warn(`[AutoSync] Failed to sync ${p.id}:`, err.error);
                    }
                } catch (e) {
                    console.warn(`[AutoSync] Failed to sync ${p.id}:`, e);
                }
            });
        }, 2000);

        return () => clearTimeout(timer);
    }, [session, allProjects, refreshLocal]);

    return null;
}

