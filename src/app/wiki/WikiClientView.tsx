"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Zap,
    Layers,
    Wrench,
    ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SystemHeader } from '@/components/ui/SystemHeader';
import { MarkdownRenderer } from './MarkdownRenderer';
import { getDocInfo } from '@/config/docRegistry';
import { useRouter } from 'next/navigation';

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
    slug: string;
    title: string;
    items: WikiDoc[];
}

interface WikiClientViewProps {
    initialUserSections: WikiDocSection[];
    initialDeveloperSections: WikiDocSection[];
    initialSlug?: string;
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
                                ? 'text-primary translate-x-1'
                                : 'text-zinc-500 hover:text-secondary'
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
                                                    className="absolute inset-y-0 -left-px w-[2px] bg-primary shadow-[0_0_10px_rgba(255,140,0,0.5)] z-20"
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
    initialDeveloperSections,
    initialSlug
}) => {
    const [mode, setMode] = useState<WikiMode>('user');
    const [activeSectionId, setActiveSectionId] = useState<string>('');
    const [activeItemId, setActiveItemId] = useState<string>('');
    const [visibleItemsCount, setVisibleItemsCount] = useState<number>(20);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const isNavigatingRef = useRef(false);
    const router = useRouter();

    const sections = useMemo(() => (mode === 'user' ? initialUserSections : initialDeveloperSections), [mode, initialUserSections, initialDeveloperSections]);
    
    // Automatically switch mode based on URL if not already set correctly
    useEffect(() => {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        // Path should be /wiki/[mode]/[slug]
        if (pathParts[0] === 'wiki') {
            const pathMode = pathParts[1] as WikiMode;
            if (pathMode === 'user' || pathMode === 'developer') {
                if (pathMode !== mode) {
                    setMode(pathMode);
                }
            }
        }
    }, [mode]);

    const activeSection = useMemo(() => sections.find(s => s.id === activeSectionId) || sections[0], [sections, activeSectionId]);

    // Track previously active section to handle smooth replacement
    const prevSectionIdRef = useRef<string>(activeSectionId);

    const nextSection = useMemo(() => {
        const currentIndex = sections.findIndex(s => s.id === activeSection?.id);
        return (currentIndex !== -1 && sections[currentIndex + 1]) || null;
    }, [sections, activeSection]);

    const handleNavigate = useCallback((sectionId: string, itemId?: string, anchorId?: string) => {
        isNavigatingRef.current = true;
        const scrollTargetId = anchorId || itemId;
        const isCrossSection = sectionId !== activeSectionId;

        // Update URL slug if cross-section
        if (isCrossSection) {
            const section = sections.find(s => s.id === sectionId);
            if (section) {
                router.push(`/wiki/${mode}/${section.slug}${window.location.hash}`, { scroll: false });
            }
        }

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
            if (scrollerRef.current) {
                scrollerRef.current.scrollTop = 0;
            }

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
    }, [activeSectionId, sections, router]);

    useEffect(() => {
        if (sections.length > 0) {
            // 1. Check for Path-based Slug navigation
            // Expected initialSlug comes from server as the segment after /wiki/[mode]/
            if (initialSlug) {
                const targetSection = sections.find(s => s.slug === initialSlug);
                if (targetSection) {
                    setActiveSectionId(targetSection.id);
                    // Check if there's also a hash
                    const hash = window.location.hash.replace('#', '');
                    if (hash) {
                        setTimeout(() => handleNavigate(targetSection.id, hash, hash), 300);
                    } else {
                        setActiveItemId(targetSection.items[0].id);
                    }
                    return;
                }
            }

            // 2. Fallback to Hash-based Deep Linking (Old support)
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

            // 3. Absolute Fallback
            if (activeSectionId === '' || !sections.some(s => s.id === activeSectionId)) {
                setActiveSectionId(sections[0].id);
                setActiveItemId(sections[0].items[0].id);
            }
        }
    }, [sections, handleNavigate, initialSlug, activeSectionId]);

    // 🛠️ FIX: Synchronous & Instant Section Switch
    // Use useLayoutEffect to reset scroll BEFORE browser paint
    React.useLayoutEffect(() => {
        if (!activeSection.id) return;

        // 1. Instant Scroll Reset
        if (scrollerRef.current) {
            scrollerRef.current.scrollTop = 0;
        }

        // 2. Load all content immediately to prevent layout shifts
        // We set a high number to cover most docs instantly
        setVisibleItemsCount(30);

        // 3. Clear any existing navigation flags
        const timer = setTimeout(() => {
            isNavigatingRef.current = false;
        }, 100);
        return () => clearTimeout(timer);
    }, [activeSection.id]);

    // 💡 Robust Scroll Tracking: IntersectionObserver for Sidebar Highlighting
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;

        // Use a ref to track which items are currently in view
        const intersectingItems = new Map<string, IntersectionObserverEntry>();

        const handleIntersection = (entries: IntersectionObserverEntry[]) => {
            if (isNavigatingRef.current) return;

            // Update our set of currently intersecting items
            entries.forEach(entry => {
                const id = (entry.target as HTMLElement).dataset.wikiItem;
                if (!id) return;
                if (entry.isIntersecting) {
                    intersectingItems.set(id, entry);
                } else {
                    intersectingItems.delete(id);
                }
            });

            if (intersectingItems.size === 0) return;

            // Find the most "active" item: 
            // We want the one whose top is closest to our 100px trigger point
            const itemsArray = Array.from(intersectingItems.values());
            itemsArray.sort((a, b) => {
                const aTop = a.boundingClientRect.top;
                const bTop = b.boundingClientRect.top;
                return Math.abs(aTop - 100) - Math.abs(bTop - 100);
            });

            const bestMatch = itemsArray[0];
            const closestId = (bestMatch.target as HTMLElement).dataset.wikiItem;

            if (closestId && closestId !== activeItemId) {
                // Find section and update active states
                const section = sections.find(s => s.items.some(i => i.id === closestId));
                if (section && section.id !== activeSectionId) setActiveSectionId(section.id);
                setActiveItemId(closestId);
            }
        };

        // rootMargin: -100px from top means the detection zone starts 100px down.
        // We look at the top 40% of the screen.
        const observer = new IntersectionObserver(handleIntersection, {
            root: scroller,
            rootMargin: '-100px 0px -60% 0px',
            threshold: [0, 0.1, 0.5]
        });

        // Observe elements that are already rendered
        const observeTargets = () => {
            const items = scroller.querySelectorAll('[data-wiki-item]');
            items.forEach(item => observer.observe(item));
        };

        observeTargets();

        // MutationObserver to catch items being progressively loaded
        const mutationObserver = new MutationObserver(() => {
            observeTargets();
        });
        mutationObserver.observe(scroller, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            mutationObserver.disconnect();
        };
    }, [sections, activeSection.id, activeItemId, activeSectionId]);

    if (!activeSection) return null;

    return (
        <div className="h-screen flex flex-col bg-[#121212] text-zinc-400 font-sans selection:bg-blue-500/30">
            <div className="fixed inset-0 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0)', backgroundSize: '20px 20px' }} />

            <SystemHeader
                showModeSwitcher
                mode={mode}
                onModeChange={(m) => {
                    const newMode = m as WikiMode;
                    setMode(newMode);
                    // Reset to the first section of the new mode
                    const newSections = newMode === 'user' ? initialUserSections : initialDeveloperSections;
                    if (newSections.length > 0) {
                        router.push(`/wiki/${newMode}/${newSections[0].slug}`, { scroll: false });
                    }
                }}
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
                    <div
                        key={activeSection.id}
                        className="space-y-24 max-w-4xl mx-auto w-full"
                    >
                        <header id={activeSection.id} className="mb-16">
                            <div className={`inline-block px-3 py-1 border text-[10px] font-bold mb-6 tracking-[0.2em] uppercase ${mode === 'user' ? 'border-secondary/30 text-secondary' : 'border-primary/30 text-primary'}`}>
                                {mode === 'user' ? 'User Manual V1.0' : 'Developer Specs V1.0'}
                            </div>
                            <h2 className="text-6xl font-black text-white tracking-tighter uppercase mb-8 leading-none">
                                {activeSection.title}
                            </h2>
                            <div className="w-12 h-1 bg-primary/50 mb-8" />
                        </header>

                        <div className="space-y-40">
                            {activeSection.items.slice(0, visibleItemsCount).map(item => (
                                <div key={item.id} id={item.id} data-wiki-item={item.id} className="scroll-mt-24">
                                    <MarkdownRenderer content={item.content} />
                                </div>
                            ))}
                        </div>

                        <div className="mt-48 flex flex-col pt-12 pb-32 border-t border-white/5">
                            {nextSection ? (
                                <button
                                    onClick={() => handleNavigate(nextSection.id)}
                                    className="group flex flex-col items-start gap-4 hover:opacity-80 transition-opacity cursor-pointer"
                                >
                                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Next Module</span>
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-3xl font-bold text-white uppercase tracking-tighter">{nextSection.title}</h3>
                                        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-primary transition-colors">
                                            <ArrowRight className="w-5 h-5 text-white group-hover:text-primary transition-colors" />
                                        </div>
                                    </div>
                                </button>
                            ) : (
                                <div className="text-center opacity-50">
                                    <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-[0.4em]">End of Documentation</span>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};
