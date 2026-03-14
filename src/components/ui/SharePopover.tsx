import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Globe, Lock, Check, Copy } from 'lucide-react';

interface SharePopoverProps {
    projectId: string;
    visibility: 'private' | 'public';
    onClose?: () => void;
    onVisibilityChange?: (visibility: 'private' | 'public') => void;
    showTrigger?: boolean;
    align?: 'left' | 'right';
}

export function SharePopover({
    projectId,
    visibility = 'private',
    onVisibilityChange,
    showTrigger = true,
    align = 'right'
}: SharePopoverProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleCopyLink = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!projectId) return;
        const url = `${window.location.origin}/d/cloud:${projectId.replace(/^(cloud:)+/i, '')}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Close on click outside
    React.useEffect(() => {
        if (!isOpen) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div 
            ref={containerRef}
            className="relative" 
            onClick={e => e.stopPropagation()}
        >
            {showTrigger && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all border
                        ${visibility === 'public' 
                            ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 hover:bg-blue-500/20' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-72 bg-black border border-zinc-800 rounded-xl shadow-2xl z-50 p-4 ring-1 ring-white/10`}
                    >
                            <div className="flex flex-col gap-4">
                                {onVisibilityChange && (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Visibility</span>
                                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${visibility === 'public' ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                                {visibility}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button 
                                                onClick={() => { onVisibilityChange('private'); }}
                                                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-[10px] font-bold uppercase transition-all
                                                    ${visibility === 'private' ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-transparent border-zinc-900 text-zinc-600 hover:text-zinc-400 hover:border-zinc-800'}`}
                                            >
                                                <Lock className="w-3.5 h-3.5" />
                                                Private
                                            </button>
                                            <button 
                                                onClick={() => { onVisibilityChange('public'); }}
                                                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-[10px] font-bold uppercase transition-all
                                                    ${visibility === 'public' ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-transparent border-zinc-900 text-zinc-600 hover:text-zinc-400 hover:border-zinc-800'}`}
                                            >
                                                <Globe className="w-3.5 h-3.5" />
                                                Public
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {visibility === 'public' && (
                                    <>
                                        <div className="h-px bg-zinc-900" />
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Share Link</span>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1 group">
                                                    <input 
                                                        readOnly 
                                                        value={typeof window !== 'undefined' ? `${window.location.origin}/d/cloud:${projectId.replace(/^(cloud:)+/i, '')}` : ''}
                                                        className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-zinc-400 focus:outline-none focus:border-blue-500/50 transition-colors"
                                                    />
                                                </div>
                                                <button 
                                                    onClick={handleCopyLink}
                                                    className="px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg border border-zinc-800 transition-all active:scale-95"
                                                >
                                                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
