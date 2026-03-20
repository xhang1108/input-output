import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, LayoutGrid, Terminal } from 'lucide-react';
import { AuthButton } from './AuthButton';

type WikiMode = 'user' | 'developer';

interface SystemHeaderProps {
    showModeSwitcher?: boolean;
    mode?: WikiMode;
    onModeChange?: (mode: WikiMode) => void;
    title?: string;
    isDashboard?: boolean;
    subtitle?: string;
    onDashboardClick?: () => void;
    onWikiClick?: () => void;
    isLoading?: boolean;
}

export function SystemHeader({
    showModeSwitcher,
    mode,
    onModeChange,
    title = "Input-Output",
    isDashboard = false,
    subtitle,
    onDashboardClick,
    onWikiClick,
    isLoading = false,
}: SystemHeaderProps) {
    return (
        <header className="sticky top-0 z-50 border-b border-surface-base bg-surface-dim">
            <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    {!isDashboard ? (
                        onDashboardClick ? (
                            <button onClick={onDashboardClick} className="group flex items-center gap-2 text-[10px] uppercase tracking-widest text-text-muted hover:text-white transition-all bg-surface-base/50 hover:bg-surface-light px-3 py-1.5 rounded-md border border-surface-light">
                                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                                <span className="font-bold">Dashboard</span>
                            </button>
                        ) : (
                            <Link href="/dashboard" className="group flex items-center gap-2 text-[10px] uppercase tracking-widest text-text-muted hover:text-white transition-all bg-surface-base/50 hover:bg-surface-light px-3 py-1.5 rounded-md border border-surface-light cursor-pointer">
                                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                                <span className="font-bold">Dashboard</span>
                            </Link>
                        )
                    ) : (
                        onWikiClick ? (
                            <motion.button 
                                whileTap={{ scale: 0.95 }}
                                onClick={onWikiClick} 
                                disabled={isLoading}
                                className={`group flex items-center gap-2 text-[10px] uppercase tracking-widest transition-all bg-surface-base/50 hover:bg-surface-light px-3 py-1.5 rounded-md border border-surface-light cursor-pointer
                                           ${isLoading ? 'text-primary animate-pulse cursor-wait' : 'text-text-muted hover:text-white'}`}
                            >
                                {isLoading ? (
                                    <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <BookOpen className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                                )}
                                <span className="font-bold">{isLoading ? 'Loading Wiki' : 'System Wiki'}</span>
                            </motion.button>
                        ) : (
                            <Link href="/wiki" className="group flex items-center gap-2 text-[10px] uppercase tracking-widest text-text-muted hover:text-white transition-all bg-surface-base/50 hover:bg-surface-light px-3 py-1.5 rounded-md border border-surface-light cursor-pointer">
                                <BookOpen className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                                <span className="font-bold">System Wiki</span>
                            </Link>
                        )
                    )}

                    <div className="h-4 w-px bg-white/10" />

                    <div className="flex items-center gap-3">
                        {isDashboard ? <Terminal className="w-4 h-4 text-primary" /> : <BookOpen className="w-4 h-4 text-primary" />}
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-[0.3em] text-white uppercase italic leading-none">{title}</span>
                            {subtitle && <span className="text-[8px] text-text-muted font-mono tracking-widest uppercase mt-1">{subtitle}</span>}
                        </div>
                    </div>
                </div>

                {showModeSwitcher && onModeChange && (
                    <div className="flex bg-surface-dim border border-surface-light p-1 rounded-lg">
                        {(['user', 'developer'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => onModeChange(m)}
                                className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${mode === m
                                    ? 'bg-surface-light text-white shadow-lg'
                                    : 'text-zinc-600 hover:text-text-dim'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                )}

                {/* Auth & Share Container - Right Aligned */}
                <div className="flex items-center gap-4 ml-auto">
                    <AuthButton />
                </div>
            </div>
        </header>
    );
}
