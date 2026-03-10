import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, LayoutGrid, Terminal } from 'lucide-react';

type WikiMode = 'operator' | 'engineer';

interface SystemHeaderProps {
    showModeSwitcher?: boolean;
    mode?: WikiMode;
    onModeChange?: (mode: WikiMode) => void;
    title?: string;
    isDashboard?: boolean;
    subtitle?: string;
}

export function SystemHeader({
    showModeSwitcher,
    mode,
    onModeChange,
    title = "I/O System Blueprint",
    isDashboard = false,
    subtitle
}: SystemHeaderProps) {
    return (
        <header className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950/60 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    {!isDashboard ? (
                        <Link href="/" className="group flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-white transition-all bg-zinc-900/50 hover:bg-zinc-800 px-3 py-1.5 rounded-md border border-zinc-800">
                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                            <span className="font-bold">Dashboard</span>
                        </Link>
                    ) : (
                        <Link href="/wiki" className="group flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-white transition-all bg-zinc-900/50 hover:bg-zinc-800 px-3 py-1.5 rounded-md border border-zinc-800">
                            <BookOpen className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                            <span className="font-bold">System Wiki</span>
                        </Link>
                    )}

                    <div className="h-4 w-px bg-white/10" />

                    <div className="flex items-center gap-3">
                        {isDashboard ? <Terminal className="w-4 h-4 text-blue-500" /> : <BookOpen className="w-4 h-4 text-blue-500" />}
                        <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-[0.3em] text-white uppercase italic leading-none">{title}</span>
                            {subtitle && <span className="text-[8px] text-zinc-500 font-mono tracking-widest uppercase mt-1">{subtitle}</span>}
                        </div>
                    </div>
                </div>

                {showModeSwitcher && onModeChange && (
                    <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-lg">
                        {(['operator', 'engineer'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => onModeChange(m)}
                                className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${mode === m
                                    ? 'bg-zinc-800 text-white shadow-lg'
                                    : 'text-zinc-600 hover:text-zinc-400'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </header>
    );
}
