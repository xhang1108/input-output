'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from "next-auth/react";
import { v7 as uuidv7 } from 'uuid';
import {
    Plus, Trash2, Pencil, Check, X,
    Box, GitBranch, Clock, Cloud, HardDrive,
    ArrowDownToLine
} from 'lucide-react';
import { toast } from 'sonner';
import { SaveManager, SaveSlotMeta } from '../../services/SaveManager';

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
}) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [nameInput, setNameInput] = useState(meta.name);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const submitRename = () => {
        const trimmed = nameInput.trim();
        if (trimmed && trimmed !== meta.name) {
            onRename(trimmed);
        }
        setIsRenaming(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`group relative flex flex-col overflow-hidden border border-zinc-900 
                       rounded-xl bg-linear-to-br transition-all duration-300
                       ${isCloud ? 'from-blue-900/10 to-blue-900/5 shadow-[0_0_15px_-3px_rgba(59,130,246,0.1)]' : 'from-zinc-900/50 to-zinc-900/30'}
                       ${loading ? 'opacity-70 pointer-events-none' : 'hover:border-zinc-700 hover:shadow-xl hover:-translate-y-1 cursor-pointer'} 
                       ${isTransferring ? 'animate-pulse' : ''}`}
            whileTap={{ scale: 0.97, opacity: 0.8 }}
            onClick={() => !loading && onOpen()}
        >
            {/* ── Type Badge ── */}
            <div className={`absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${isCloud
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700'}`}>
                {isTransferring ? (
                    <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                    isCloud ? <Cloud className="w-2.5 h-2.5" /> : <HardDrive className="w-2.5 h-2.5" />
                )}
                {isTransferring ? 'Syncing...' : (isCloud ? 'Cloud' : 'Local')}
            </div>

            {/* Visual Header / Thumbnail */}
            <div className={`aspect-16/10 relative flex items-center justify-center overflow-hidden
                           ${isCloud ? 'bg-blue-500/5' : 'bg-zinc-800/20'}`}>
                
                {loading ? (
                    <div className="flex flex-col items-center gap-2">
                         <div className="w-8 h-8 border-2 border-unit border-t-transparent rounded-full animate-spin" />
                         <span className="text-[10px] uppercase tracking-widest text-unit font-bold">Opening</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                            <span className={`text-3xl font-bold ${isCloud ? 'text-blue-400/70' : 'text-zinc-500'}`}>{meta.nodeCount}</span>
                            <span className={`text-[10px] uppercase tracking-wider ${isCloud ? 'text-blue-500/50' : 'text-zinc-600'}`}>nodes</span>
                        </div>
                        <div className={`w-px h-10 ${isCloud ? 'bg-blue-900/30' : 'bg-zinc-800'}`} />
                        <div className="flex flex-col items-center">
                            <span className={`text-3xl font-bold ${isCloud ? 'text-blue-400/70' : 'text-zinc-500'}`}>{meta.edgeCount}</span>
                            <span className={`text-[10px] uppercase tracking-wider ${isCloud ? 'text-blue-500/50' : 'text-zinc-600'}`}>edges</span>
                        </div>
                    </div>
                )}
                
                {/* Decorative corner dots */}
                <div className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full ${isCloud ? 'bg-blue-500/20' : 'bg-zinc-800'}`} />
                <div className={`absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full ${isCloud ? 'bg-blue-500/20' : 'bg-zinc-800'}`} />
                <div className={`absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full ${isCloud ? 'bg-blue-500/20' : 'bg-zinc-800'}`} />

                {isCloud && !loading && (
                    <motion.div
                        animate={{ rotate: [0, 5, 0, -5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute bottom-2 right-2"
                    >
                        <Cloud className="w-6 h-6 text-blue-500/20" />
                    </motion.div>
                )}
            </div>

            {/* ── Info Section ── */}
            <div className="p-3 space-y-2">
                {/* Title Row */}
                <div className="flex items-center justify-between min-h-[28px]">
                    {isRenaming ? (
                        <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
                            <input
                                autoFocus
                                value={nameInput}
                                onChange={e => setNameInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                                className="flex-1 bg-zinc-800 border border-zinc-600 rounded-sm px-2 py-0.5 text-sm text-zinc-100
                                           outline-none focus:border-unit"
                            />
                            <button onClick={submitRename} className="p-1 text-emerald-400 hover:text-emerald-300">
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setIsRenaming(false)} className="p-1 text-zinc-500 hover:text-zinc-300">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <span className="text-sm font-semibold text-zinc-200 truncate flex-1">{meta.name}</span>
                    )}
                </div>

                {/* Meta Row */}
                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1 ml-auto">
                        <Clock className="w-3 h-3" /> {timeAgo(meta.updatedAt)}
                    </span>
                </div>

                {/* Action Row */}
                <div
                    className="flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        onClick={onOpen}
                        className={`flex-1 text-xs py-1.5 rounded-sm font-medium transition-colors cursor-pointer ${isCloud
                            ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                            : 'bg-unit/15 text-unit hover:bg-unit/25'
                            }`}
                    >
                        {loading ? 'Opening...' : 'Open'}
                    </button>

                    {isCloud ? (
                        <button
                            onClick={() => onTransfer(false)}
                            className="p-1.5 rounded-sm text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                            title="Make Local Only"
                        >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        canSyncToCloud && (
                            <button
                                onClick={() => onTransfer(true)}
                                className="p-1.5 rounded-sm text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                                title="Sync to Cloud"
                            >
                                <Cloud className="w-3.5 h-3.5" />
                            </button>
                        )
                    )}

                    <button
                        onClick={() => { setNameInput(meta.name); setIsRenaming(true); }}
                        className="p-1.5 rounded-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Rename"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {confirmDelete ? (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={onDelete}
                                className="text-[10px] px-2 py-1 rounded-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium cursor-pointer"
                            >
                                Confirm
                            </button>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="p-1.5 rounded-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
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
            className={`flex flex-col items-center justify-center border-2 border-dashed
                       rounded-xl min-h-[220px] transition-all duration-200 group
                       ${(disabled || loading) ? 'opacity-40 cursor-not-allowed border-zinc-800' : 'cursor-pointer'}
                       ${isCloud 
                          ? 'bg-blue-900/5 border-blue-900/30 hover:border-blue-500/50 hover:bg-blue-900/10 shadow-[0_0_15px_-3px_rgba(59,130,246,0.05)]' 
                          : 'bg-zinc-900/30 border-zinc-800 hover:border-unit/50 hover:bg-zinc-900/50'}`}
        >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors duration-200
                          ${isCloud 
                             ? 'bg-blue-900/20 text-blue-500 group-hover:bg-blue-500/20' 
                             : 'bg-zinc-800 text-zinc-500 group-hover:bg-unit/20 group-hover:text-unit'}`}>
                {loading ? (
                    <div className="w-6 h-6 border-2 border-unit border-t-transparent rounded-full animate-spin" />
                ) : (
                    isCloud ? <Cloud className="w-6 h-6" /> : <Plus className="w-6 h-6" />
                )}
            </div>
            <div className="flex flex-col items-center text-center px-4">
                <span className={`text-sm font-bold uppercase tracking-widest ${isCloud ? 'text-blue-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                    {loading ? 'Initialising...' : 'New Project'}
                </span>
                <span className="text-[10px] text-zinc-600 mt-1">
                    {loading ? 'Please wait' : (description || (isCloud ? 'Synced with D1' : 'Saved in Browser'))}
                </span>
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

    const refreshLocal = useCallback(() => {
        setSlots(SaveManager.list());
    }, []);

    // Initial load + legacy migration
    useEffect(() => {
        SaveManager.migrateLegacy();
        refreshLocal();
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
                    version: "2.0"
                };
            });

            setCloudSlots(mappedSlots);
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
                
                loadCloudGraphs();
            } catch (e) {
                console.error(e);
                toast.error("Failed to delete cloud graph");
            }
        } else {
            SaveManager.delete(id);
            refreshLocal();
        }
    };

    const handleRename = async (id: string, name: string, isCloud: boolean) => {
        if (isCloud) {
            try {
                const apiId = getCanonicalId(id);
                const res = await fetch(`/api/graphs/${apiId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: name })
                });
                if (!res.ok) throw new Error("Failed to rename cloud graph");
                loadCloudGraphs();
            } catch (e) {
                console.error(e);
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
                localStorage.setItem(`io-slot-${id}`, rawData);
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
            // Keep the best metadata
            updatedAt: Math.max(s.updatedAt, existing?.updatedAt || 0),
            nodeCount: s.nodeCount || existing?.nodeCount || 0,
            edgeCount: s.edgeCount || existing?.edgeCount || 0
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
        const id = uuidv7();
        setLoadingId('new-project');
        if (canCreateCloud) {
            onNewProject(`cloud:${id}`);
            toast.info("Initialising cloud-synced project");
        } else {
            onNewProject(id);
            if (!session) toast.info("Creating Local project (Signed out)");
            else if (cloudSlots.length >= 20) toast.warning("Cloud limit reached, creating Local");
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-auto bg-black relative">
            {/* Sync Status Floating Indicator */}
            {isLoadingCloud && (
                <div className="absolute top-6 right-8 flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full z-20">
                    <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Syncing Cloud</span>
                </div>
            )}

            <main className="flex-1 px-8 py-20">
                <div className="max-w-6xl mx-auto space-y-12">
                    
                    {/* Header Section */}
                    <div className="flex flex-col items-center text-center space-y-2">
                        <h1 className="text-3xl font-black tracking-tighter text-white">DASHBOARD</h1>
                        <p className="text-zinc-500 text-sm max-w-md">Manage your local and cloud-synced projects in one place.</p>
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
                                        canSyncToCloud={!!session && cloudSlots.length < 20}
                                    />
                                );
                            })}
                        </AnimatePresence>
                    </div>

                    {allProjects.length === 0 && !isLoadingCloud && (
                        <div className="py-20 text-center space-y-4">
                            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
                                <Box className="w-8 h-8 text-zinc-700" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-zinc-400 font-medium">No projects yet</h3>
                                <p className="text-sm text-zinc-600">Start by creating a local or cloud-synced project above.</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

