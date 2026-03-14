import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Share2, GitFork, ChevronUp, Copy, Check } from 'lucide-react';
import { SharePopover } from './SharePopover';

interface FloatingProjectControlsProps {
    isOwner: boolean;
    projectId: string;
    onBack: () => void;
    onFork: (target: 'cloud' | 'local') => void;
    visibility?: 'private' | 'public';
}

export function FloatingProjectControls({ 
    isOwner, 
    projectId, 
    onBack, 
    onFork,
    visibility 
}: FloatingProjectControlsProps) {
    const [isShareOpen, setIsShareOpen] = useState(false);

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-black/90 border border-zinc-800 backdrop-blur-xl rounded-2xl h-14 px-2 flex items-center gap-1 shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-visible"
            >
                {/* Back Link */}
                <button 
                    onClick={onBack}
                    className="h-10 px-4 flex items-center gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all font-bold uppercase tracking-widest text-[10px] group"
                >
                    <LayoutDashboard className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                    <span className="hidden sm:inline">Dashboard</span>
                </button>

                <div className="w-px h-6 bg-zinc-800 mx-1" />

                {isOwner ? (
                   <div className="relative">
                        <button 
                            onClick={() => setIsShareOpen(!isShareOpen)}
                            className={`h-10 px-4 flex items-center gap-2 rounded-xl transition-all font-bold uppercase tracking-widest text-[10px] group
                                ${isShareOpen ? 'bg-unit/10 text-unit' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
                        >
                            <Share2 className="w-4 h-4" />
                            <span>Share</span>
                        </button>
                        
                        <AnimatePresence>
                            {isShareOpen && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute bottom-full left-1/2 -translate-x-1/2 pb-4 z-50"
                                >
                                    <SharePopover 
                                        projectId={projectId}
                                        visibility={visibility || 'private'}
                                        onClose={() => setIsShareOpen(false)}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                   </div>
                ) : (
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => onFork('local')}
                            className="h-10 px-4 flex items-center gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all font-bold uppercase tracking-widest text-[10px] group"
                        >
                            <Copy className="w-4 h-4" />
                            <span>Fork to Local</span>
                        </button>
                        <div className="w-px h-4 bg-zinc-800" />
                        <button 
                            onClick={() => onFork('cloud')}
                            className="h-10 px-4 flex items-center gap-2 text-unit hover:bg-unit/10 rounded-xl transition-all font-bold uppercase tracking-widest text-[10px] group"
                        >
                            <GitFork className="w-4 h-4 transition-transform group-hover:scale-110" />
                            <span>Fork to Cloud</span>
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
