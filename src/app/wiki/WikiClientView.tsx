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

type WikiMode = 'operator' | 'engineer';

export interface WikiDocMeta {
    title: string;
    order: number;
    icon?: string;
}

export interface WikiDoc {
    id: string;
    metadata: WikiDocMeta;
    content: string;
}

export interface WikiSection {
    id: string;
    title: string;
    items: WikiDoc[];
}

interface WikiClientViewProps {
    initialOperatorSections: WikiSection[];
    initialEngineerSections: WikiSection[];
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
    sections: WikiSection[],
    activeSectionId: string,
    activeItemId: string,
    onNavigate: (sectionId: string, itemId?: string) => void
}) => {
    return (
        <aside className="w-72 shrink-0 hidden lg:block sticky top-20 self-start max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar border-r border-white/5 pr-6 py-4">
            <div className="text-[9px] text-white/20 font-bold uppercase tracking-[0.4em] mb-10">System_Directory</div>
            <nav className="space-y-10">
                {sections.map(section => (
                    <div key={section.id} className="space-y-4">
                        <button
                            onClick={() => onNavigate(section.id)}
                            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${activeSectionId === section.id
                                ? 'text-blue-500'
                                : 'text-white/40 hover:text-white/60'
                                }`}
                        >
                            {IconMap[section.items[0]?.metadata.icon || 'Wrench']}
                            <span>{section.title}</span>
                        </button>
                        <ul className="space-y-1.5 ml-3 border-l border-white/5 pl-4">
                            {section.items.map(item => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => onNavigate(section.id, item.id)}
                                        className={`w-full text-left text-[11px] transition-all duration-150 flex items-center gap-3 group ${activeItemId === item.id
                                            ? 'text-white translate-x-1'
                                            : 'text-zinc-600 hover:text-zinc-400'
                                            }`}
                                    >
                                        <div className={`w-1 h-1 rounded-full transition-all ${activeItemId === item.id ? 'bg-blue-500 scale-125' : 'bg-white/10 group-hover:bg-white/30'
                                            }`} />
                                        {item.metadata.title}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>
        </aside>
    );
};

export const WikiClientView: React.FC<WikiClientViewProps> = ({
    initialOperatorSections,
    initialEngineerSections
}) => {
    const [mode, setMode] = useState<WikiMode>('operator');
    const [activeSectionId, setActiveSectionId] = useState<string>('');
    const [activeItemId, setActiveItemId] = useState<string>('');
    const scrollerRef = useRef<HTMLDivElement>(null);
    const isNavigatingRef = useRef(false);

    const sections = useMemo(() => (mode === 'operator' ? initialOperatorSections : initialEngineerSections), [mode, initialOperatorSections, initialEngineerSections]);
    const activeSection = useMemo(() => sections.find(s => s.id === activeSectionId) || sections[0], [sections, activeSectionId]);

    const nextSection = useMemo(() => {
        const currentIndex = sections.findIndex(s => s.id === activeSection?.id);
        return (currentIndex !== -1 && sections[currentIndex + 1]) || null;
    }, [sections, activeSection]);

    const handleNavigate = useCallback((sectionId: string, itemId?: string, anchorId?: string) => {
        isNavigatingRef.current = true;
        const scrollTargetId = anchorId || itemId;

        if (sectionId !== activeSectionId) {
            setActiveSectionId(sectionId);

            // Shorter delay + smooth behavior for a "seamless" transition
            setTimeout(() => {
                if (scrollTargetId) {
                    const el = document.getElementById(scrollTargetId);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        if (itemId) setActiveItemId(itemId);
                    }
                } else {
                    scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    const section = sections.find(s => s.id === sectionId);
                    if (section?.items.length) {
                        setActiveItemId(section.items[0].id);
                    }
                }
                // Unlock sidebar sync after a short delay for scroll completion
                setTimeout(() => { isNavigatingRef.current = false; }, 400);
            }, 100);
        } else if (scrollTargetId) {
            const el = document.getElementById(scrollTargetId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (itemId) setActiveItemId(itemId);
            }
            setTimeout(() => { isNavigatingRef.current = false; }, 500);
        } else {
            scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            isNavigatingRef.current = false;
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
                if (sections[0].items.length > 0) {
                    setActiveItemId(sections[0].items[0].id);
                }
            }
        }
        if (scrollerRef.current && activeSectionId === '') scrollerRef.current.scrollTop = 0;
    }, [mode, sections, handleNavigate, activeSectionId, initialEngineerSections, initialOperatorSections]);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;

        const syncSidebar = () => {
            if (isNavigatingRef.current) return;
            const items = scroller.querySelectorAll('[data-wiki-item]');
            if (!items.length) return;

            const scrollerRect = scroller.getBoundingClientRect();
            const center = scrollerRect.top + scrollerRect.height / 2;

            if (scroller.scrollTop < 20) {
                if (activeSection?.items.length > 0) {
                    setActiveItemId(activeSection.items[0].id);
                    return;
                }
            }

            let closestId = '';
            let minDistance = Infinity;

            items.forEach((item) => {
                const rect = item.getBoundingClientRect();
                const distance = Math.abs(center - rect.top);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestId = (item as HTMLElement).dataset.wikiItem || '';
                }
            });

            if (closestId && closestId !== activeItemId) {
                setActiveItemId(closestId);
            }
        };

        let frameId: number;
        const onScroll = () => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(syncSidebar);
        };

        scroller.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            scroller.removeEventListener('scroll', onScroll);
            cancelAnimationFrame(frameId);
        };
    }, [activeItemId, activeSection]);

    if (!activeSection) return null;

    return (
        <div className="h-screen flex flex-col bg-zinc-950 text-zinc-400 font-sans selection:bg-blue-500/30">
            <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />

            <SystemHeader
                showModeSwitcher
                mode={mode}
                onModeChange={(m) => setMode(m as WikiMode)}
                title="I/O System Blueprint"
                subtitle={`ENGINE: STABLE_V1.3 // ${mode.toUpperCase()}_MODE_ACTIVE`}
            />

            <div className="flex-1 flex max-w-7xl mx-auto px-8 w-full overflow-hidden">
                <WikiSidebar
                    sections={sections}
                    activeSectionId={activeSectionId}
                    activeItemId={activeItemId}
                    onNavigate={handleNavigate}
                />

                <main ref={scrollerRef} className="flex-1 overflow-y-auto no-scrollbar px-12 pb-0 pt-12 scroll-smooth">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.25 }}
                            className="space-y-24"
                        >
                            <header id={activeSection.id} className="mb-16">
                                <div className={`inline-block px-3 py-1 border text-[10px] font-bold mb-6 tracking-[0.2em] uppercase ${mode === 'operator' ? 'border-blue-500/30 text-blue-400' : 'border-purple-500/30 text-purple-400'}`}>
                                    {mode === 'operator' ? 'Operator Manual v1.3' : 'Engineering Specs v2.1'}
                                </div>
                                <h2 className="text-6xl font-black text-white tracking-tighter uppercase mb-8 leading-none">
                                    {activeSection.title}
                                </h2>
                                <div className="w-12 h-1 bg-blue-500/50 mb-8" />
                            </header>

                            <div className="space-y-40">
                                {activeSection.items.map(item => (
                                    <div key={item.id} id={item.id} data-wiki-item={item.id} className="scroll-mt-24">
                                        <MarkdownRenderer content={item.content} />
                                    </div>
                                ))}
                            </div>

                            <div className="min-h-[50vh] flex flex-col justify-end pb-32 border-t border-white/5">
                                {nextSection ? (
                                    <button
                                        onClick={() => handleNavigate(nextSection.id)}
                                        className="group flex flex-col items-start gap-4 hover:opacity-80 transition-opacity"
                                    >
                                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Next Module / 次部模塊</span>
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-3xl font-bold text-white uppercase tracking-tighter">{nextSection.title}</h3>
                                            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-blue-500 transition-colors">
                                                <ArrowRight className="w-5 h-5 text-white group-hover:text-blue-500 transition-colors" />
                                            </div>
                                        </div>
                                    </button>
                                ) : (
                                    <div className="text-center opacity-50">
                                        <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-[0.4em]">End of Documentation // 終端數據</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>

            <StatusBarContent
                mode="IDLE"
                nodeCount={0}
                selectionCount={0}
                isStandalone={true}
            />
        </div>
    );
};
