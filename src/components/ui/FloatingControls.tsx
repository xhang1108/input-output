import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Terminal, Cloud, HardDrive } from 'lucide-react';
import { SharePopover } from './SharePopover';
import { AuthButton } from './AuthButton';

interface FloatingControlsProps {
    title: string;
    projectId: string;
    visibility?: 'private' | 'public';
    onVisibilityChange?: (visibility: 'private' | 'public') => void;
    onBack?: () => void;
}

export function FloatingControls({
    title,
    projectId,
    visibility = 'private',
    onVisibilityChange,
    onBack
}: FloatingControlsProps) {
    const isCloud = projectId.startsWith('cloud:');

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-100 flex items-center gap-3 px-4 py-2 bg-zinc-950/60 backdrop-blur-xl border border-zinc-900 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] ring-1 ring-white/5 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Back Button */}
            <button 
                onClick={onBack}
                className="group flex items-center gap-2 p-1.5 hover:bg-zinc-800 rounded-full transition-all text-zinc-500 hover:text-white"
                title="Back to Dashboard"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <div className="w-px h-4 bg-zinc-800 mx-1" />

            {/* Project Info */}
            <div className="flex items-center gap-3 px-2">
                <div className={`p-1.5 rounded-lg ${isCloud ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    {isCloud ? <Cloud className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em] italic max-w-[200px] truncate">
                        {title}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-mono tracking-widest uppercase truncate max-w-[150px]">
                        {projectId}
                    </span>
                </div>
            </div>

            <div className="w-px h-4 bg-zinc-800 mx-1" />

            {/* Share & Auth */}
            <div className="flex items-center gap-2">
                {isCloud && (
                    <SharePopover 
                        projectId={projectId}
                        visibility={visibility}
                        onVisibilityChange={onVisibilityChange}
                    />
                )}
                
                <div className="h-4 w-px bg-zinc-800 mx-1" />
                
                <div className="scale-75 origin-right pr-1">
                    <AuthButton />
                </div>
            </div>
        </div>
    );
}
