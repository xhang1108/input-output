import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Globe, Lock, Check, Copy, CloudOff } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import { toast } from 'sonner';

interface SharePopoverProps {
    projectId: string;
    visibility: 'private' | 'public';
    onClose?: () => void;
    onVisibilityChange?: (visibility: 'private' | 'public') => void;
    showTrigger?: boolean;
    align?: 'left' | 'right' | 'center';
    activeSlotId?: string | null;
    onOpen?: () => void;
    isOpen?: boolean;
    side?: 'top' | 'bottom';
}

export function SharePopover({
    projectId,
    visibility = 'private',
    onVisibilityChange,
    showTrigger = true,
    align = 'right',
    activeSlotId,
    onOpen,
    onClose,
    isOpen: controlledIsOpen,
    side = 'bottom'
}: SharePopoverProps) {
    const { data: session, status } = useSession();
    const [internalIsOpen, setInternalIsOpen] = React.useState(false);
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
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
                setInternalIsOpen(false);
                onClose?.();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    // Close if another card becomes active
    React.useEffect(() => {
        if (activeSlotId && activeSlotId !== projectId && isOpen) {
            setInternalIsOpen(false);
            onClose?.();
        }
    }, [activeSlotId, projectId, isOpen, onClose]);

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
                        const next = !isOpen;
                        setInternalIsOpen(next);
                        if (next) onOpen?.();
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all border
                        ${visibility === 'public'
                            ? 'bg-cloud/10 border-cloud/50 text-text-cloud hover:bg-cloud/20'
                            : 'bg-surface-base border-surface-light text-zinc-500 hover:text-white hover:bg-surface-light'}`}
                >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? 10 : -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? 10 : -10 }}
                        className={`absolute 
                            ${align === 'right' ? 'right-0' : (align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0')} 
                            ${side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'} 
                            w-72 bg-black border border-surface-light rounded-xl shadow-2xl z-50 p-4 ring-1 ring-white/10`}
                    >
                        {status === 'unauthenticated' ? (
                            <div className="flex flex-col items-center text-center gap-4 py-2">
                                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 group">
                                    <CloudOff className="w-6 h-6 text-red-500/80 group-hover:scale-110 transition-transform" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">Cloud Sharing Disabled</h3>
                                    <p className="text-[9px] text-zinc-500 leading-relaxed max-w-[200px] mx-auto">
                                        Sign in to upload your project and generate a permanent sharing link.
                                    </p>
                                </div>
                                <button
                                    onClick={() => signIn('google')}
                                    className="w-full py-2.5 bg-white text-black hover:bg-zinc-200 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.1)] cursor-pointer"
                                >
                                    Sign in with Google
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {!projectId.startsWith('cloud:') ? (
                                    <div className="flex flex-col items-center text-center gap-4 py-2">
                                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                            <Globe className="w-6 h-6 text-blue-500/80" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">Share to Cloud</h3>
                                            <p className="text-[9px] text-zinc-500 leading-relaxed max-w-[200px] mx-auto">
                                                This is a local project. Save it to your Cloud account to enable sharing.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {onVisibilityChange && (
                                            <div className="flex flex-col gap-2 p-2 bg-surface-base/50 rounded-lg border border-surface-light/50">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest px-1">Visibility</span>
                                                </div>
                                                <div className="flex gap-1 p-1 bg-black rounded-md border border-surface-light/30">
                                                    <button
                                                        onClick={() => onVisibilityChange('private')}
                                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded transition-all text-[10px] font-bold uppercase tracking-wider
                                                                    ${visibility === 'private' ? 'bg-surface-light text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                    >
                                                        <Lock className="w-3 h-3" />
                                                        Private
                                                    </button>
                                                    <button
                                                        onClick={() => onVisibilityChange('public')}
                                                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded transition-all text-[10px] font-bold uppercase tracking-wider
                                                                    ${visibility === 'public' ? 'bg-cloud/20 text-text-cloud' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                    >
                                                        <Globe className="w-3 h-3" />
                                                        Public
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {visibility === 'public' && (
                                            <div className="flex flex-col gap-2 p-2 bg-cloud/5 rounded-lg border border-cloud/10">
                                                <span className="text-[9px] font-bold text-text-cloud/70 uppercase tracking-widest px-1">Share Link</span>
                                                <div className="flex items-center gap-2 px-3 py-2 bg-black rounded-md border border-cloud/20">
                                                    <input
                                                        readOnly
                                                        value={`${window.location.origin}/d/cloud:${projectId.replace(/^(cloud:)+/i, '')}`}
                                                        className="flex-1 bg-transparent text-[10px] text-zinc-400 focus:outline-none font-mono truncate"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const url = `${window.location.origin}/d/cloud:${projectId.replace(/^(cloud:)+/i, '')}`;
                                                            navigator.clipboard.writeText(url);
                                                            toast.success('Link copied!');
                                                        }}
                                                        className="p-1.5 hover:bg-cloud/10 rounded transition-colors text-text-cloud"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {!onVisibilityChange && visibility === 'private' && (
                                            <p className="text-[9px] text-zinc-500 text-center py-2">
                                                Only the project owner can change visibility settings.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

