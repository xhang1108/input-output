"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

const DividerPreview = () => {
    const styles = [
        {
            id: 'S01',
            name: 'Scanline Pulse',
            render: (title: string) => (
                <div className="group relative pt-16 mt-24">
                    <h2 className="text-white text-2xl font-bold uppercase tracking-tight flex items-center gap-6">
                        <span className="shrink-0">{title}</span>
                        <div className="h-px bg-white/5 flex-1 relative overflow-hidden">
                            <motion.div 
                                className="absolute inset-0 bg-blue-500/30 w-1/4"
                                animate={{ left: ["-25%", "100%"] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            />
                        </div>
                    </h2>
                </div>
            )
        },
        {
            id: 'S02',
            name: 'Mechanical Tag',
            render: (title: string) => (
                <div className="relative pt-8 border-t border-white/5 mt-24">
                    <div className="absolute top-0 right-0 text-[10px] font-mono border-x border-b border-white/10 px-3 py-1 rounded-b bg-zinc-900 text-zinc-500 font-bold">
                        SEC_02 // 0xAF
                    </div>
                    <h2 className="text-white text-3xl font-black italic uppercase tracking-tighter">{title}</h2>
                </div>
            )
        },
        {
            id: 'S03',
            name: 'Spinal Blueprint',
            render: (title: string) => (
                <div className="relative pl-8 mt-24">
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-linear-to-b from-blue-500/50 via-white/5 to-transparent" />
                    <div className="absolute left-[-4px] top-2 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    <h2 className="text-white text-2xl font-bold tracking-widest uppercase">{title}</h2>
                </div>
            )
        },
        {
            id: 'S04',
            name: 'Breadcrumb Matrix',
            render: (title: string) => (
                <div className="mt-24 flex flex-col gap-4">
                    <div className="flex gap-2">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className={`h-1 w-8 rounded-full ${i === 3 ? 'bg-blue-500' : 'bg-white/5'}`} />
                        ))}
                    </div>
                    <h2 className="text-white text-4xl font-extrabold uppercase tracking-tighter">{title}</h2>
                </div>
            )
        },
        {
            id: 'S05',
            name: 'Terminal System Prompt',
            render: (title: string) => (
                <div className="bg-white/5 p-6 border-l-4 border-blue-500 rounded-r-lg mt-24">
                    <div className="text-[10px] font-mono text-blue-400 mb-2 animate-pulse">{">>>"} INITIALIZING_MODULE...</div>
                    <h2 className="text-white font-mono text-xl font-bold uppercase tracking-tighter">
                        [ SYSTEM::{title.replace(/\s/g, '_')} ]
                    </h2>
                </div>
            )
        },
        {
            id: 'S06',
            name: 'Glassmorphism Frost',
            render: (title: string) => (
                <div className="relative py-12 px-8 -mx-8 bg-white/2 backdrop-blur-sm border-y border-white/5 mt-24">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                    <h2 className="text-white text-3xl font-light tracking-[0.2em] uppercase">{title}</h2>
                </div>
            )
        },
        {
            id: 'S07',
            name: 'ASCII Geometric Frame',
            render: (title: string) => (
                <div className="flex flex-col items-center gap-2 mt-24">
                    <div className="text-zinc-600 text-[10px] tracking-[1em] font-light">////////////////////////////////</div>
                    <h2 className="text-white text-2xl font-bold uppercase tracking-[0.5em] px-10 py-2 border-x border-white/20">
                        {title}
                    </h2>
                    <div className="text-zinc-600 text-[10px] tracking-[1em] font-light">\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\</div>
                </div>
            )
        },
        {
            id: 'S08',
            name: 'Minimalist Zen Gap',
            render: (title: string) => (
                <div className="flex flex-col items-center justify-center py-32 border-t border-white/5 mt-24">
                    <div className="w-10 h-10 flex items-center justify-center border border-white/10 rounded-full mb-8 text-blue-500">
                        <Plus size={16} />
                    </div>
                    <h2 className="text-white text-5xl font-thin tracking-tighter uppercase text-center max-w-lg">
                        {title}
                    </h2>
                </div>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-[#121212] p-20 text-zinc-400 overflow-y-auto">
            <header className="mb-20">
                <h1 className="text-white text-6xl font-black uppercase tracking-tighter mb-4">Divider Catalog</h1>
                <p className="text-zinc-500">Previewing 8 different styles for Wiki H2 sections.</p>
            </header>

            <div className="max-w-4xl space-y-40">
                {styles.map(style => (
                    <section key={style.id} className="relative">
                        <div className="absolute -top-10 left-0 text-[10px] font-bold text-blue-500/50 uppercase tracking-widest">
                            {style.id}: {style.name}
                        </div>
                        {style.render("Module Nomenclature")}
                        <div className="mt-8 text-sm text-zinc-600">
                            Content starts here... Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default DividerPreview;
