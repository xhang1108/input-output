"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Zap,
    Layers,
    Wrench,
    ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusBarContent } from '../../components/ui/StatusBar';
import { SystemHeader } from '@/components/ui/SystemHeader';
import { MarkdownRenderer } from './MarkdownRenderer';
import { getDocInfo } from '@/config/docRegistry';

type WikiMode = 'user' | 'developer';

export interface WikiDocMeta {
    title: string;
    order: number;
    icon?: string;
}

export interface WikiTOCItem {
    id: string;
    title: string;
    level: number;
}

export interface WikiDoc {
    id: string;
    metadata: WikiDocMeta;
    content: string;
    toc: WikiTOCItem[];
}

export interface WikiDocSection {
    id: string;
    title: string;
    items: WikiDoc[];
}

interface WikiClientViewProps {
    initialUserSections: WikiDocSection[];
    initialDeveloperSections: WikiDocSection[];
}

const IconMap: Record<string, React.ReactNode> = {
    Wrench: <Wrench className="w-4 h-4" />,
    Zap: <Zap className="w-4 h-4" />,
    Layers: <Layers className="w-4 h-4" />,
};

const WikiSidebar = ({
    sections,
    activeSectionId,
    activeItemId,
    onNavigate
}: {
    sections: WikiDocSection[],
    activeSectionId: string,
    activeItemId: string,
    onNavigate: (sectionId: string, itemId?: string, anchorId?: string) => void
}) => {
    return (
        <aside className="w-72 shrink-0 hidden lg:block sticky top-20 self-start max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar border-r border-white/5 pr-6 py-4">
            <div className="text-[9px] text-white/20 font-bold uppercase tracking-[0.4em] mb-10">System_Directory</div>
            <nav className="space-y-10">
                {sections.map(section => (
                    <div key={section.id} className="space-y-4">
                        <button
                            onClick={() => onNavigate(section.id)}
                            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-200 cursor-pointer ${activeSectionId === section.id
                                ? 'text-blue-500 translate-x-1'
                                : 'text-white/40 hover:text-white/60'
                                }`}
                        >
                            <span>{section.title}</span>
                        </button>

                        <AnimatePresence initial={false}>
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                                className="overflow-hidden"
                            >
                                <div className="mt-1 flex flex-col gap-0.5 border-l border-zinc-900 ml-3">
                                    {section.items.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => onNavigate(section.id, item.id)}
                                            className={`group flex items-center justify-between py-1.5 pl-4 pr-3 text-[11px] transition-all relative cursor-pointer
                                                        ${activeItemId === item.id
                                                    ? 'text-white'
                                                    : 'text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            <span className="truncate relative z-10">{item.metadata.title}</span>
                                            {activeItemId === item.id && (
                                                <motion.div
                                                    layoutId="active-item-bg"
                                                    className="absolute inset-y-0 -left-px w-[2px] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] z-20"
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                ))}
            </nav>
        </aside>
    );
};

export const WikiClientView: React.FC<WikiClientViewProps> = ({
    initialUserSections,
    initialDeveloperSections
}) => {
    const [mode, setMode] = useState<WikiMode>('user');
    const [activeSectionId, setActiveSectionId] = useState<string>('');
    const [activeItemId, setActiveItemId] = useState<string>('');
    const [visibleItemsCount, setVisibleItemsCount] = useState<number>(1);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const isNavigatingRef = useRef(false);

    const sections = useMemo(() => (mode === 'user' ? initialUserSections : initialDeveloperSections), [mode, initialUserSections, initialDeveloperSections]);
    const activeSection = useMemo(() => sections.find(s => s.id === activeSectionId) || sections[0], [sections, activeSectionId]);

    const nextSection = useMemo(() => {
        const currentIndex = sections.findIndex(s => s.id === activeSection?.id);
        return (currentIndex !== -1 && sections[currentIndex + 1]) || null;
    }, [sections, activeSection]);

    const handleNavigate = useCallback((sectionId: string, itemId?: string, anchorId?: string) => {
        isNavigatingRef.current = true;
        const scrollTargetId = anchorId || itemId;
        const isCrossSection = sectionId !== activeSectionId;

        if (isCrossSection) {
            // Speed up rendering for the target section
            if (itemId) {
                const section = sections.find(s => s.id === sectionId);
                const itemIndex = section?.items.findIndex(i => i.id === itemId) ?? -1;
                if (itemIndex !== -1) {
                    setVisibleItemsCount(Math.max(2, itemIndex + 1));
                }
            } else {
                setVisibleItemsCount(2);
            }

            // Cross-section: Instant jump/fade
            setActiveSectionId(sectionId);
            if (itemId) setActiveItemId(itemId);
            else {
                const section = sections.find(s => s.id === sectionId);
                if (section?.items.length) setActiveItemId(section.items[0].id);
            }

            // Scroll scroller to top immediately so new content starts at 0
            scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' });

            // Wait for mounting then attempt to scroll to specific item if provided
            if (itemId || anchorId) {
                let attempts = 0;
                const tryInstantScroll = () => {
                    const el = document.getElementById(scrollTargetId!);
                    if (el) {
                        el.scrollIntoView({ behavior: 'auto', block: 'start' });
                        setTimeout(() => { isNavigatingRef.current = false; }, 400);
                    } else if (attempts < 20) {
                        attempts++;
                        setTimeout(tryInstantScroll, 30);
                    } else {
                        isNavigatingRef.current = false;
                    }
                };
                setTimeout(tryInstantScroll, 50);
            } else {
                setTimeout(() => { isNavigatingRef.current = false; }, 400);
            }
        } else {
            // Same-section: Smooth scroll
            if (itemId) setActiveItemId(itemId);

            const performSmooth = () => {
                if (!scrollTargetId) {
                    scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    setTimeout(() => { isNavigatingRef.current = false; }, 800);
                    return;
                }

                const el = document.getElementById(scrollTargetId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setTimeout(() => { isNavigatingRef.current = false; }, 1000);
                } else {
                    isNavigatingRef.current = false;
                }
            };
            setTimeout(performSmooth, 50);
        }
    }, [activeSectionId, sections]);

    useEffect(() => {
        if (sections.length > 0) {
            // Check for Hash-based Deep Linking
            const hash = window.location.hash.replace('#', '');
            if (hash) {
                let targetDocId = hash;
                const docInfo = getDocInfo(hash);
                if (docInfo) targetDocId = docInfo.sectionId;

                // Strictly find only in current mode sections
                const targetSection = sections.find(s => s.items.some(i => i.id === targetDocId));
                if (targetSection) {
                    setActiveSectionId(targetSection.id);
                    setTimeout(() => handleNavigate(targetSection.id, targetDocId, hash), 300);
                    return;
                }
            }

            // Fallback to initial
            if (activeSectionId === '') {
                setActiveSectionId(sections[0].id);
                setActiveItemId(sections[0].items[0].id);
            }
        }
    }, [sections, handleNavigate]);

    // Progressive Loading: Reset and stagger item rendering on section change
    useEffect(() => {
        setVisibleItemsCount(2); // Show first 2 items immediately

        if (activeSection.items.length > 2) {
            const timer = setInterval(() => {
                setVisibleItemsCount(prev => {
                    if (prev >= activeSection.items.length) {
                        clearInterval(timer);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 150); // Stagger every 150ms
            return () => clearInterval(timer);
        }
    }, [activeSection.id, activeSection.items.length]);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;

        // Callback for IntersectionObserver
        const handleIntersection = (entries: IntersectionObserverEntry[]) => {
            if (isNavigatingRef.current) return;

            // We only care about entries that are intersecting
            // Sort by top position to find the one closest to our "trigger zone"
            const visibleEntries = entries
                .filter(entry => entry.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

            if (visibleEntries.length > 0) {
                // The first entry is the one highest up in the viewport
                const closestId = (visibleEntries[0].target as HTMLElement).dataset.wikiItem;

                if (closestId) {
                    const section = sections.find(s => s.items.some(i => i.id === closestId));
                    if (section && section.id !== activeSectionId) {
                        setActiveSectionId(section.id);
                    }
                    if (closestId !== activeItemId) {
                        setActiveItemId(closestId);
                    }
                }
            }
        };

        // Root margin: -100px from top means we start looking 100px down.
        // -80% bottom means we ignore everything in the bottom 80% of the screen.
        // This forces the "active" item to be the one entering/occupying the top 20% area.
        const observerOptions = {
            root: scroller,
            rootMargin: '-100px 0px -80% 0px',
            threshold: [0, 0.1, 0.5, 1.0]
        };

        const observer = new IntersectionObserver(handleIntersection, observerOptions);

        // Observe all wiki items
        const items = scroller.querySelectorAll('[data-wiki-item]');
        items.forEach(item => observer.observe(item));

        return () => {
            observer.disconnect();
        };
    }, [activeItemId, activeSectionId, sections, activeSection.id]);

    if (!activeSection) return null;

    return (
        <div className="h-screen flex flex-col bg-[#121212] text-zinc-400 font-sans selection:bg-blue-500/30">
            <div className="fixed inset-0 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0)', backgroundSize: '20px 20px' }} />

            <SystemHeader
                showModeSwitcher
                mode={mode}
                onModeChange={(m) => setMode(m as WikiMode)}
                title="I/O System Blueprint"
                subtitle={`ENGINE: V1.0 // ${mode.toUpperCase()}_MODE_ACTIVE`}
            />

            <div className="flex-1 flex max-w-7xl mx-auto px-8 w-full overflow-hidden">
                <WikiSidebar
                    sections={sections}
                    activeSectionId={activeSectionId}
                    activeItemId={activeItemId}
                    onNavigate={handleNavigate}
                />

                <main ref={scrollerRef} className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-12 pb-0 pt-12">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-24 max-w-4xl mx-auto w-full"
                        >
                            <header id={activeSection.id} className="mb-16">
                                <div className={`inline-block px-3 py-1 border text-[10px] font-bold mb-6 tracking-[0.2em] uppercase ${mode === 'user' ? 'border-blue-500/30 text-blue-400' : 'border-purple-500/30 text-purple-400'}`}>
                                    {mode === 'user' ? 'User Manual V1.0' : 'Developer Specs V1.0'}
                                </div>
                                <h2 className="text-6xl font-black text-white tracking-tighter uppercase mb-8 leading-none">
                                    {activeSection.title}
                                </h2>
                                <div className="w-12 h-1 bg-blue-500/50 mb-8" />
                            </header>

                            <div className="space-y-40">
                                {activeSection.items.slice(0, visibleItemsCount).map(item => (
                                    <div key={item.id} id={item.id} data-wiki-item={item.id} className="scroll-mt-24">
                                        <MarkdownRenderer content={item.content} />
                                    </div>
                                ))}
                            </div>

                            <div className="min-h-[50vh] flex flex-col justify-end pb-32 border-t border-white/5">
                                {nextSection ? (
                                    <button
                                        onClick={() => handleNavigate(nextSection.id)}
                                        className="group flex flex-col items-start gap-4 hover:opacity-80 transition-opacity cursor-pointer"
                                    >
                                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Next Module</span>
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-3xl font-bold text-white uppercase tracking-tighter">{nextSection.title}</h3>
                                            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-blue-500 transition-colors">
                                                <ArrowRight className="w-5 h-5 text-white group-hover:text-blue-500 transition-colors" />
                                            </div>
                                        </div>
                                    </button>
                                ) : (
                                    <div className="text-center opacity-50">
                                        <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-[0.4em]">End of Documentation</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};
