
import { useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useAppStore } from '../../store/useStore';

import { CATEGORY_PRIORITY } from '../../constants/categories';

export interface CategorizedMenuItem {
    id: string;
    label: string;
    category: string;
    aliases?: string[];
    description?: ReactNode;
    data?: any;
    icon?: ReactNode;
    isVariant?: boolean; // If true, hide from default list when search is empty
}

interface CategorizedMenuProps {
    isOpen: boolean;
    items: CategorizedMenuItem[];
    trigger?: HTMLElement | null;
    position?: { x: number; y: number };
    onClose: () => void;
    onSelect: (item: CategorizedMenuItem, isContinuous: boolean) => void;
    placeholder?: string;
    width?: string;
    maxHeight?: string;
    followZoom?: boolean;
    yOffset?: number;
    showCategories?: boolean;
    showSearch?: boolean;
    selectedId?: string;
}

/**
 * CategorizedMenu
 * A Blender-style searchable menu with category grouping and keyboard navigation.
 */
export function CategorizedMenu({
    isOpen,
    items,
    trigger,
    position,
    onClose,
    onSelect,
    placeholder = "Search...",
    width = "36",
    maxHeight = "500px",
    followZoom = true,
    yOffset = 6,
    showCategories = false,
    showSearch = false,
    selectedId
}: CategorizedMenuProps) {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [isPositioned, setIsPositioned] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [dynamicMaxHeight, setDynamicMaxHeight] = useState<string>(maxHeight);
    const initialFlipYRef = useRef<boolean | null>(null);

    const { getViewport } = useReactFlow();
    const { zoom } = getViewport();
    const menuLayout = useAppStore(s => s.menuLayout);

    // Ensure we are on the client
    useEffect(() => {
        setMounted(true);
    }, []);

    // Type for hierarchical grouping
    interface CategoryGroup {
        name: string;
        fullName: string;
        items: CategorizedMenuItem[];
        subCategories: Record<string, CategoryGroup>;
    }


    // 1. Filter and Score based on search
    const baseFilteredItems = useMemo(() => {
        const searchLower = search.trim().toLowerCase();
        
        if (!searchLower) {
            // No search: Only show base items (non-variants)
            return items.filter(item => !item.isVariant);
        }

        // Search active: Score items for relevance
        const searchNormalized = searchLower.replace(/[^a-z0-9]/g, '');

        const scored = items.map(item => {
            let score = 0;
            const labelLower = item.label.toLowerCase();
            const idLower = item.id.toLowerCase();
            const idNormalized = idLower.replace(/[^a-z0-9]/g, '');
            
            // 1. ID Match (Code Search, e.g. "cl05" -> "CL-05")
            // No hardcoding, handles various formats via normalization
            const isNumericSearch = /^\d+$/.test(searchNormalized);
            if (idLower === searchLower || (searchNormalized && idNormalized === searchNormalized)) {
                score = 110;
            } else if (idLower.startsWith(searchLower) || (searchNormalized && idNormalized.startsWith(searchNormalized))) {
                score = 95;
            } else if (searchNormalized && isNumericSearch && idNormalized.endsWith(searchNormalized)) {
                // Suffix match for numeric codes (e.g. "05" matches "CL-05")
                score = 90;
            }
            
            // 2. Label Match (Primary)
            let labelScore = 0;
            if (labelLower === searchLower) labelScore = 100;
            else if (labelLower.startsWith(searchLower)) labelScore = 80;
            else if (labelLower.includes(searchLower)) labelScore = 40;
            
            score = Math.max(score, labelScore);
            
            // 3. Alias Match (Secondary)
            const aliasMatch = item.aliases?.some(a => a.toLowerCase() === searchLower);
            const aliasStart = item.aliases?.some(a => a.toLowerCase().startsWith(searchLower));
            const aliasInclude = item.aliases?.some(a => a.toLowerCase().includes(searchLower));
            
            let aliasScore = 0;
            if (aliasMatch) aliasScore = 90; // Higher than startsWith label to prioritize exact keyword matches
            else if (aliasStart) aliasScore = 60;
            else if (aliasInclude) aliasScore = 20;

            score = Math.max(score, aliasScore);
            
            return { item, score };
        }).filter(entry => entry.score > 0);

        // Sort by score (descending), then maintain original order for ties
        return scored
            .sort((a, b) => b.score - a.score)
            .map(entry => entry.item);
    }, [items, search]);

    // 2. Hierarchical grouping (Hierarchical)
    const hierarchicalGroups = useMemo(() => {
        const root: Record<string, CategoryGroup> = {};

        baseFilteredItems.forEach(item => {
            const category = item.category || 'General';
            const parts = category.split('.');
            let current = root;
            let path = '';

            parts.forEach((part, index) => {
                path = path ? `${path}.${part}` : part;
                if (!current[part]) {
                    current[part] = {
                        name: part,
                        fullName: path,
                        items: [],
                        subCategories: {}
                    };
                }

                if (index === parts.length - 1) {
                    current[part].items.push(item);
                }
                current = current[part].subCategories;
            });
        });

        return root;
    }, [baseFilteredItems]);

    // 3. Final flattened visual order and categories
    const { sortedCategories, visuallyOrderedItems } = useMemo(() => {
        // If categories are hidden, preserve raw input order exactly
        if (!showCategories) {
            return { sortedCategories: [], visuallyOrderedItems: baseFilteredItems };
        }

        const rootGroups: { rootName: string; subgroups: { displayName: string; items: CategorizedMenuItem[]; depth: number; fullName: string }[] }[] = [];
        const orderedItems: CategorizedMenuItem[] = [];

        // Use centralized order for root categories
        const rootPriority = CATEGORY_PRIORITY;

        const traverse = (groups: Record<string, CategoryGroup>, depth: number, rootTarget: { displayName: string; items: CategorizedMenuItem[]; depth: number; fullName: string }[]) => {
            const sortedKeys = Object.keys(groups).sort();

            sortedKeys.forEach(key => {
                const group = groups[key];
                if (group.items.length > 0) {
                    rootTarget.push({
                        fullName: group.fullName,
                        displayName: group.name,
                        items: group.items,
                        depth
                    });
                    orderedItems.push(...group.items);
                }
                traverse(group.subCategories, depth + 1, rootTarget);
            });
        };

        // Process root categories
        const rootKeys = Object.keys(hierarchicalGroups);
        const orderedRootKeys = [
            ...rootPriority.filter(k => rootKeys.includes(k)),
            ...rootKeys.filter(k => !rootPriority.includes(k)).sort()
        ];

        orderedRootKeys.forEach(rootKey => {
            const subgroups: { displayName: string; items: CategorizedMenuItem[]; depth: number; fullName: string }[] = [];
            const group = hierarchicalGroups[rootKey];

            // Add root items first if any
            if (group.items.length > 0) {
                subgroups.push({
                    fullName: group.fullName,
                    displayName: group.name,
                    items: group.items,
                    depth: 0
                });
                orderedItems.push(...group.items);
            }

            // Traverse children and collect into the SAME root group
            traverse(group.subCategories, 1, subgroups);

            if (subgroups.length > 0) {
                rootGroups.push({
                    rootName: rootKey,
                    subgroups
                });
            }
        });

        return { sortedCategories: rootGroups, visuallyOrderedItems: orderedItems };
    }, [hierarchicalGroups]);

    const filteredItems = visuallyOrderedItems;

    // Reset selection when search changes or menu opens
    useEffect(() => {
        if (!search && selectedId) {
            const index = visuallyOrderedItems.findIndex(item => item.id === selectedId);
            if (index !== -1) {
                setSelectedIndex(index);
                return;
            }
        }
        setSelectedIndex(0);
    }, [search, selectedId, visuallyOrderedItems, isOpen]);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Handle viewport boundaries for smart positioning
    const menuRef = useRef<HTMLDivElement>(null);
    const [flipState, setFlipState] = useState({ x: false, y: false });

    useEffect(() => {
        if (!isOpen) {
            initialFlipYRef.current = null;
            return;
        }

        let requestId: number;

        const updatePosition = () => {
            if (!menuRef.current) return;

            let x = position?.x || 0;
            let y = position?.y || 0;

            const currentZoom = followZoom ? zoom : 1;

            let flipY = y;

            // If trigger element is provided, use it for real-time tracking
            if (trigger) {
                const rect = trigger.getBoundingClientRect();
                x = rect.left;
                y = rect.bottom + yOffset;
                flipY = rect.top - yOffset;
            }

            const menuEl = menuRef.current;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            const menuRawHeight = menuEl.offsetHeight;
            const scaledHeight = menuRawHeight * currentZoom;
            
            // 1. Determine Flip Logic (Locked on first open to prevent jitter)
            const padding = 20; // Safety margin in physical pixels
            const rect = trigger ? trigger.getBoundingClientRect() : { bottom: y, top: y, left: x, width: 0 };
            
            const spaceBelow = viewportHeight - rect.bottom - padding;
            const spaceAbove = rect.top - padding;

            if (initialFlipYRef.current === null) {
                // Force always downward as requested
                initialFlipYRef.current = false;
            }

            const shouldFlipY = false; // Forced downward
            const finalY = y; // Always use current Y (button bottom)

            // 2. Position X (Flip left if no space on right)
            const menuRawWidth = menuEl.offsetWidth;
            const scaledWidth = menuRawWidth * currentZoom;
            const shouldFlipX = x + scaledWidth > viewportWidth - 20;
            
            const finalX = shouldFlipX 
                ? Math.max(10, x + (trigger ? trigger.offsetWidth : 0) - menuRawWidth) 
                : x;

            // 3. Dynamic Max Height Calculation (Zoom Aware)
            // CSS maxHeight applies to the unscaled element, so we must divide physical space by zoom
            let availablePhysicalSpace = shouldFlipY ? spaceAbove : spaceBelow;
            let finalMaxH = Math.max(150, availablePhysicalSpace / currentZoom);
            
            setDynamicMaxHeight(`${finalMaxH}px`);

            menuEl.style.left = `${finalX}px`;
            menuEl.style.top = `${finalY}px`;
            menuEl.style.transform = `scale(${currentZoom})`;
            menuEl.style.transformOrigin = `${shouldFlipY ? 'bottom' : 'top'} ${shouldFlipX ? 'right' : 'left'}`;
            
            // Once positioned, flag it so we can start the entrance animation
            if (!isPositioned && menuRawWidth > 0) {
                // Double rAF to ensure layout is flushed before showing
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        setIsPositioned(true);
                    });
                });
            }

            // Only continue tracking if there's a trigger element to follow
            if (trigger) {
                requestId = requestAnimationFrame(updatePosition);
            }
        };

        // Run synchronously once first to set initial layout before animation frame
        updatePosition();

        requestId = requestAnimationFrame(updatePosition);
        return () => cancelAnimationFrame(requestId);
    }, [isOpen, position, trigger, zoom]);

    const handleWheel = (e: React.WheelEvent) => {
        if (!scrollContainerRef.current) return;

        // Horizontal Menu Scrolling Shortcuts
        // Shift + Scroll -> scrolls horizontally
        // Ctrl + Scroll -> scrolls horizontally (faster)

        if (e.shiftKey) {
            scrollContainerRef.current.scrollLeft += e.deltaY;
        } else if (e.ctrlKey) {
            e.preventDefault();
            scrollContainerRef.current.scrollLeft += e.deltaY * 2;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredItems[selectedIndex]) {
                const item = filteredItems[selectedIndex];
                const isContinuous = e.ctrlKey || e.metaKey;
                onSelect(item, isContinuous);

                if (isContinuous) {
                    setSearch('');
                    setTimeout(() => inputRef.current?.focus(), 0);
                } else {
                    onClose();
                }
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    // Auto-scroll to selected item
    useEffect(() => {
        if (scrollContainerRef.current) {
            const selectedElement = scrollContainerRef.current.querySelector('[data-selected="true"]');
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <>
            {/* Backdrop for click-away closing */}
            <div
                className="fixed inset-0 z-9999 content-none cursor-default"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onClose();
                }}
            />
            <div
                ref={menuRef}
                className={`fixed z-10000 bg-surface-dim border border-surface-light rounded-[14px] flex flex-col p-1 transition-opacity duration-75 ${
                    isPositioned ? 'animate-in fade-in duration-200 ease-out opacity-100' : 'opacity-0'
                }`}
                style={{
                    maxHeight: dynamicMaxHeight,
                    maxWidth: '95vw',
                    width: menuLayout === 'horizontal' ? 'auto' : (width.startsWith('w-') ? undefined : `${parseInt(width) * 4}px`),
                }}
                onClick={e => e.stopPropagation()}
                onContextMenu={e => e.preventDefault()}
            >
                {/* Search Input */}
                {showSearch && (
                    <div className="p-1 border-b border-surface-light/30 mb-1">
                        <div className="flex items-center px-2 py-1 bg-surface-base rounded-sm border border-surface-light/50 focus-within:border-primary/40 transition-colors">
                            <Search className="w-3 h-3 text-zinc-500 mr-2" />
                            <input
                                ref={inputRef}
                                className="bg-transparent text-[10px] text-zinc-200 outline-none w-full placeholder-zinc-700 font-medium"
                                placeholder={placeholder}
                                value={search}
                                onFocus={(e) => e.target.select()}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    </div>
                )}

                {/* Items Container */}
                <div
                    ref={scrollContainerRef}
                    className={`px-1 py-1.5 pr-1 gap-1 overflow-y-auto overflow-x-hidden transition-colors menu-scrollbar ${menuLayout === 'horizontal'
                        ? 'flex flex-row overflow-y-hidden pt-1'
                        : 'flex flex-col overflow-x-hidden pt-0'
                        }`}
                    style={{ maxHeight: `calc(${dynamicMaxHeight} - ${showSearch ? '70px' : '30px'})` }}
                >
                    {filteredItems.length === 0 ? (
                        <div className="px-4 py-8 text-zinc-500 text-[10px] text-center italic w-full">
                            No results found
                        </div>
                    ) : !showCategories ? (
                        <div className="flex flex-col gap-0.5 pt-1">
                            {filteredItems.map((item) => {
                                const globalIndex = filteredItems.indexOf(item);
                                const isSelected = globalIndex === selectedIndex;
                                return <MenuItem key={item.id} item={item} isSelected={isSelected} globalIndex={globalIndex} onSelect={onSelect} onClose={onClose} setSelectedIndex={setSelectedIndex} setSearch={setSearch} search={search} inputRef={inputRef} />;
                            })}
                        </div>
                    ) : menuLayout === 'horizontal' ? (
                        sortedCategories.map((root) => (
                            <div key={root.rootName} className="flex flex-col flex-nowrap gap-x-0.5 content-start pr-2 last:pr-0 whitespace-nowrap">
                                <div className="sticky top-0 z-10 w-full bg-surface-dim">
                                    <div className="px-2 py-1.5 text-[8px] uppercase tracking-[0.15em] font-black text-primary/80 border-b border-surface-light/30">
                                        {root.rootName}
                                    </div>
                                </div>
                                {root.subgroups.map((category) => (
                                    <div key={category.fullName} className="flex flex-col">
                                        {category.depth > 0 && (
                                            <div className={`sticky left-0 z-10 bg-surface-dim ${category.depth > 0 ? 'pt-2 border-t border-white/5' : ''}`}>
                                                <div className="px-2 py-1 text-[7px] uppercase tracking-widest font-bold text-zinc-500 flex items-center gap-2 mb-0.5 border-b border-white/5">
                                                    <div className="w-1 h-1 bg-zinc-700 rounded-full" />
                                                    {category.displayName}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-0.5 mb-2 last:mb-0">
                                            {category.items.map((item) => {
                                                const globalIndex = filteredItems.indexOf(item);
                                                const isSelected = globalIndex === selectedIndex;
                                                return <MenuItem key={item.id} item={item} isSelected={isSelected} globalIndex={globalIndex} onSelect={onSelect} onClose={onClose} setSelectedIndex={setSelectedIndex} setSearch={setSearch} search={search} inputRef={inputRef} />;
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    ) : (
                        sortedCategories.map((root) => (
                            <div key={root.rootName} className="flex flex-col pb-2 mb-2 last:pb-0 last:mb-0">
                                <div className="sticky top-0 z-10 w-full bg-surface-dim">
                                    <div className="px-2 py-1.5 text-[8px] uppercase tracking-[0.15em] font-black text-primary/80 border-b border-surface-light/30">
                                        {root.rootName}
                                    </div>
                                </div>
                                {root.subgroups.map((category) => (
                                    <div key={category.fullName} className="flex flex-col mb-1 last:mb-0">
                                        {category.depth > 0 && (
                                            <div className="px-2 py-1 text-[7px] uppercase tracking-widest font-bold text-zinc-500 flex items-center gap-2 mb-0.5">
                                                <div className="w-1 h-1 bg-border-dim rounded-full" />
                                                {category.displayName}
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-0.5 ml-1">
                                            {category.items.map((item) => {
                                                const globalIndex = filteredItems.indexOf(item);
                                                const isSelected = globalIndex === selectedIndex;
                                                return <MenuItem key={item.id} item={item} isSelected={isSelected} globalIndex={globalIndex} onSelect={onSelect} onClose={onClose} setSelectedIndex={setSelectedIndex} setSearch={setSearch} search={search} inputRef={inputRef} />;
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

            </div>
        </>,
        document.body
    );
}

interface MenuItemProps {
    item: CategorizedMenuItem;
    isSelected: boolean;
    globalIndex: number;
    onSelect: (item: CategorizedMenuItem, isContinuous: boolean) => void;
    onClose: () => void;
    setSelectedIndex: (index: number) => void;
    setSearch: (search: string) => void;
    search: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
}

function MenuItem({ item, isSelected, globalIndex, onSelect, onClose, setSelectedIndex, setSearch, search, inputRef }: MenuItemProps) {
    const renderHighlighted = (text: string, query: string) => {
        if (!query.trim()) return text;
        const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase()
                        ? <span key={i} className="text-primary-light font-bold underline underline-offset-2 decoration-1">{part}</span>
                        : part
                )}
            </span>
        );
    };

    return (
        <button
            key={`${item.category}-${item.id}-${item.label}`}
            data-selected={isSelected}
            className={`min-w-[120px] text-left px-3 py-1.5 text-[11px] font-medium flex items-center justify-between group transition-all relative rounded-[10px] ${isSelected
                ? 'bg-primary text-white shadow-none'
                : 'text-zinc-400 hover:bg-surface-light hover:text-zinc-200'
                }`}
            onClick={(e) => {
                const isContinuous = e.ctrlKey || e.metaKey || e.shiftKey;
                onSelect(item, isContinuous);
                if (isContinuous) {
                    setSearch('');
                    setTimeout(() => inputRef.current?.focus(), 0);
                } else {
                    onClose();
                }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={() => setSelectedIndex(globalIndex)}
        >
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {item.icon && <span className={isSelected ? 'opacity-100' : 'opacity-40'}>{item.icon}</span>}
                <div className="flex items-baseline justify-between flex-1 min-w-0 gap-2">
                    <span className="truncate">{renderHighlighted(item.label, search)}</span>
                    <span className={`text-[9px] font-mono opacity-40 shrink-0 ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                        {renderHighlighted(item.id.includes(':') ? item.id.split(':')[0] : item.id, search)}
                    </span>
                </div>
            </div>
        </button>
    );
}


