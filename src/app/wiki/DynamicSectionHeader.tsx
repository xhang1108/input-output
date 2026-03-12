"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface DynamicSectionHeaderProps {
    id: string;
    title: string;
    level?: number;
}

export const DynamicSectionHeader: React.FC<DynamicSectionHeaderProps> = ({ id, title, level = 2 }) => {
    // Generate a short ID for technical specs look
    const shortId = (id || '00').toUpperCase().substring(0, 3);
    
    return (
        <div className="group relative mt-40 mb-6">
            {/* TECHNICAL METADATA LABEL */}
            <div className="flex items-center gap-3 mb-2 select-none">
                <div className="text-[9px] font-mono text-blue-500/50 font-bold tracking-[0.2em]">
                    NODE_CAT_{shortId}
                </div>
                <div className="h-px w-8 bg-blue-500/20" />
                <div className="text-[9px] font-mono text-zinc-600 tracking-widest">
                    ADDR::0x{id.substring(0, 2).toUpperCase() || 'FF'}
                </div>
            </div>

            {/* MAIN DIVIDER SYSTEM */}
            <div className="flex items-center gap-4 group">
                {/* START HANDLE */}
                <div className="relative flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full border border-blue-500/50 bg-zinc-900" />
                    <motion.div 
                        className="absolute inset-0 rounded-full bg-blue-500/40 blur-xs"
                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                </div>

                {/* HORIZONTAL BLUE TRACE */}
                <div className="h-px w-6 bg-blue-500/50" />

                {/* SECTION TITLE */}
                <h2 id={id} className="text-white text-3xl font-black uppercase tracking-tighter leading-none m-0">
                    {title}
                </h2>

                {/* TRAILING GEOMETRY (PCB BLUEPRINT STYLE) */}
                <div className="flex-1 flex items-center relative h-6">
                    {/* CONNECTOR LINE */}
                    <div className="h-px bg-white/5 flex-1 relative overflow-hidden ml-4">
                        <motion.div 
                            className="absolute inset-0 bg-blue-500/20 w-1/4"
                            animate={{ left: ["-25%", "100%"] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        />
                    </div>
                    
                    {/* END NODE (SMALLER) */}
                    <div className="w-1 h-1 rounded-full bg-zinc-800 ml-4 group-hover:bg-blue-500/50 transition-colors" />
                </div>
            </div>

            {/* VERTICAL SPINAL CONNECTION */}
            <div className="absolute top-1 lg:top-1.5 left-[4.5px] w-px h-full bg-linear-to-b from-blue-500/40 via-white/5 to-transparent pointer-events-none" />
        </div>
);
};
