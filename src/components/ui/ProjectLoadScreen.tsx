'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FolderOpen, Plus, Trash2, Pencil, Check, X,
    Box, GitBranch, Clock, Cloud, Lock
} from 'lucide-react';
import { SaveManager, SaveSlotMeta } from '../../services/SaveManager';

// ─── Helper ───────────────────────────────────────────

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
    onOpen,
    onDelete,
    onRename,
}: {
    meta: SaveSlotMeta;
    onOpen: () => void;
    onDelete: () => void;
    onRename: (name: string) => void;
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
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="group relative bg-zinc-900 border border-zinc-800 rounded-(--radius-xl) overflow-hidden
                       hover:border-zinc-600 transition-all duration-200 cursor-pointer"
            onClick={() => { if (!isRenaming && !confirmDelete) onOpen(); }}
        >
            {/* ── Thumbnail / Node Visualizer ── */}
            <div className="h-28 bg-zinc-950 flex items-center justify-center relative overflow-hidden">
                {/* Abstract node count visualization */}
                <div className="flex items-center gap-3 text-zinc-700">
                    <div className="flex flex-col items-center">
                        <span className="text-3xl font-bold text-zinc-500">{meta.nodeCount}</span>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600">nodes</span>
                    </div>
                    <div className="w-px h-10 bg-zinc-800" />
                    <div className="flex flex-col items-center">
                        <span className="text-3xl font-bold text-zinc-500">{meta.edgeCount}</span>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600">edges</span>
                    </div>
                </div>
                {/* Decorative corner dots */}
                <div className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full bg-zinc-800" />
                <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-zinc-800" />
                <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-zinc-800" />
                <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-zinc-800" />
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
                                className="flex-1 bg-zinc-800 border border-zinc-600 rounded-(--radius-sm) px-2 py-0.5 text-sm text-zinc-100
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
                    <span className="flex items-center gap-1">
                        <Box className="w-3 h-3" /> {meta.nodeCount}
                    </span>
                    <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3" /> {meta.edgeCount}
                    </span>
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
                        className="flex-1 text-xs py-1.5 rounded-(--radius-sm) bg-unit/15 text-unit
                                   hover:bg-unit/25 font-medium transition-colors"
                    >
                        Open
                    </button>
                    <button
                        onClick={() => { setNameInput(meta.name); setIsRenaming(true); }}
                        className="p-1.5 rounded-(--radius-sm) text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                        title="Rename"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {confirmDelete ? (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={onDelete}
                                className="text-[10px] px-2 py-1 rounded-(--radius-sm) bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium"
                            >
                                Confirm
                            </button>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="p-1 text-zinc-500 hover:text-zinc-300"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="p-1.5 rounded-(--radius-sm) text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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

function NewProjectCard({ onClick }: { onClick: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            onClick={onClick}
            className="flex flex-col items-center justify-center bg-zinc-900/50 border-2 border-dashed border-zinc-800
                       rounded-(--radius-xl) min-h-[220px] cursor-pointer
                       hover:border-unit/50 hover:bg-zinc-900/80 transition-all duration-200 group"
        >
            <div className="w-12 h-12 rounded-(--radius-xl) bg-zinc-800 flex items-center justify-center mb-3
                          group-hover:bg-unit/20 transition-colors duration-200">
                <Plus className="w-6 h-6 text-zinc-500 group-hover:text-unit transition-colors" />
            </div>
            <span className="text-sm font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors">
                New Project
            </span>
        </motion.div>
    );
}

// ─── ProjectLoadScreen ────────────────────────────────

interface ProjectLoadScreenProps {
    onOpen: (slotId: string) => void;
    onNewProject: () => void;
}

export function ProjectLoadScreen({ onOpen, onNewProject }: ProjectLoadScreenProps) {
    const [slots, setSlots] = useState<SaveSlotMeta[]>([]);

    const refresh = useCallback(() => {
        setSlots(SaveManager.list());
    }, []);

    // Initial load + legacy migration
    useEffect(() => {
        // Migrate old autosave if it exists
        SaveManager.migrateLegacy();
        refresh();
    }, [refresh]);

    const handleDelete = (id: string) => {
        SaveManager.delete(id);
        refresh();
    };

    const handleRename = (id: string, name: string) => {
        SaveManager.rename(id, name);
        refresh();
    };

    return (
        <div className="fixed inset-0 bg-black z-9999 flex flex-col overflow-auto">
            {/* ── Header ── */}
            <header className="shrink-0 border-b border-zinc-900 px-8 py-6">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-(--radius-lg) bg-linear-to-br from-unit to-[hsl(270,60%,62%)] flex items-center justify-center">
                            <span className="text-white font-bold text-lg">🐙</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Calctopus</h1>
                            <p className="text-xs text-zinc-500">Select a project to open</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                        <FolderOpen className="w-4 h-4" />
                        <span>{slots.length} project{slots.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </header>

            {/* ── Grid ── */}
            <main className="flex-1 px-8 py-8">
                <div className="max-w-5xl mx-auto">
                    <AnimatePresence mode="popLayout">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <NewProjectCard onClick={onNewProject} />
                            {slots.map(meta => (
                                <SaveSlotCard
                                    key={meta.id}
                                    meta={meta}
                                    onOpen={() => onOpen(meta.id)}
                                    onDelete={() => handleDelete(meta.id)}
                                    onRename={(name) => handleRename(meta.id, name)}
                                />
                            ))}
                        </div>
                    </AnimatePresence>
                </div>
            </main>

            {/* ── Cloud Footer (Phase 2 placeholder) ── */}
            <footer className="shrink-0 border-t border-zinc-900 px-8 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-center gap-2 text-xs text-zinc-700">
                    <Lock className="w-3 h-3" />
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Cloud sync coming soon — Google Login + Cloudflare</span>
                </div>
            </footer>
        </div>
    );
}
