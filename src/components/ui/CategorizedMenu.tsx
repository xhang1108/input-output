
import { useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useAppStore } from '../../store/useStore';

export interface CategorizedMenuItem {
    id: string;
    label: string;
    category: string;
    aliases?: string[];
    description?: ReactNode;
    data?: any;
    icon?: ReactNode;
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
    yOffset = 6
}: CategorizedMenuProps) {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mounted, setMounted] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const { getViewport } = useReactFlow();
    const { zoom } = getViewport();
    const { menuLayout } = useAppStore();

    // Ensure we are on the client
    useEffect(() => {
        setMounted(true);
    }, []);

    // Flatten and filter items based on search
    const filteredItems = useMemo(() => {
        const searchLower = search.toLowerCase();
        return items.filter(item =>
            item.label.toLowerCase().includes(searchLower) ||
            item.id.toLowerCase().includes(searchLower) ||
            item.aliases?.some(alias => alias.toLowerCase().includes(searchLower))
        );
    }, [items, search]);

    // Reset selection when search changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [search]);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);


    // Type for hierarchical grouping
    interface CategoryGroup {
        name: string;
        fullName: string;
        items: CategorizedMenuItem[];
        subCategories: Record<string, CategoryGroup>;
    }

    // group items by category for rendering (Hierarchical)
    const hierarchicalGroups = useMemo(() => {
        const root: Record<string, CategoryGroup> = {};

        filteredItems.forEach(item => {
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
    }, [filteredItems]);

    // Flatten hierarchical groups for the horizontal layout, grouped by ROOT category
    const sortedCategories = useMemo(() => {
        const rootGroups: { rootName: string; subgroups: { displayName: string; items: CategorizedMenuItem[]; depth: number; fullName: string }[] }[] = [];

        // Manual order for root categories to ensure 'Input' is first
        const rootPriority = ['Input', 'Output', 'Generators', 'Math', 'Calculus', 'Data & Structures', 'Transform', 'Logic & Flow', 'Utility'];

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
                }
                traverse(group.subCategories, depth + 1, rootTarget);
            });
        };

        // 1. Process root categories
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

        return rootGroups;
    }, [hierarchicalGroups]);

    // Handle viewport boundaries for smart positioning
    const menuRef = useRef<HTMLDivElement>(null);
    const [flipState, setFlipState] = useState({ x: false, y: false });

    useEffect(() => {
        if (!isOpen) return;

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

            // 1. Position Y (flip up if no space below)
            const menuRawHeight = menuEl.offsetHeight;
            const scaledHeight = menuRawHeight * currentZoom;
            const shouldFlipY = y + scaledHeight > viewportHeight;
            const finalY = shouldFlipY ? Math.max(0, flipY - menuRawHeight) : y;

            // 2. Position X (Always start at mouse, but cap width if no space on right)
            // Instead of flipping X, we limit the element's maxWidth so it stays on screen
            const availableWidth = viewportWidth - x - 20; // 20px padding from edge
            const minPossibleWidth = 200; // Minimum usable width

            menuEl.style.left = `${x}px`;
            menuEl.style.top = `${finalY}px`;
            menuEl.style.transform = `scale(${currentZoom})`;
            menuEl.style.transformOrigin = `${shouldFlipY ? 'bottom' : 'top'} left`;
            menuEl.style.maxWidth = `min(95vw, ${Math.max(minPossibleWidth, availableWidth / currentZoom)}px)`;
            
            // First draw: position is set but it's still hidden. 
            // Second draw: it becomes visible, matching the CSS animation start.
            if (menuEl.style.visibility === 'hidden') {
                requestAnimationFrame(() => {
                    menuEl.style.visibility = 'visible';
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
                className="fixed z-10000 bg-[#141416]/95 border border-[#27272a] shadow-2xl rounded-lg overflow-visible flex flex-col animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ease-out"
                style={{
                    visibility: 'hidden',
                    maxHeight: maxHeight,
                    maxWidth: '95vw',
                    width: menuLayout === 'horizontal' ? 'auto' : '11rem',
                }}
                onClick={e => e.stopPropagation()}
                onContextMenu={e => e.preventDefault()}
            >
                {/* Search Input */}
                <div className="p-1 px-1.5 border-b border-white/5">
                    <div className="flex items-center px-2 py-1 bg-black/40 rounded border border-white/5 focus-within:border-white/20 transition-colors">
                        <Search className="w-3 h-3 text-zinc-500 mr-2" />
                        <input
                            ref={inputRef}
                            className="bg-transparent text-[10px] text-zinc-200 outline-none w-full placeholder-zinc-700 font-medium"
                            placeholder={placeholder}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>

                {/* Items Container */}
                <div
                    ref={scrollContainerRef}
                    className={`px-1 pb-1 gap-1 overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${menuLayout === 'horizontal'
                        ? 'flex flex-row overflow-y-hidden pt-1'
                        : 'flex flex-col overflow-x-hidden pt-0'
                        }`}
                    style={{ maxHeight: `calc(${maxHeight} - 60px)` }}
                >
                    {filteredItems.length === 0 ? (
                        <div className="px-4 py-8 text-zinc-500 text-[10px] text-center italic w-full">
                            No results found
                        </div>
                    ) : menuLayout === 'horizontal' ? (
                        sortedCategories.map((root) => (
                            <div key={root.rootName} className="flex flex-col flex-nowrap gap-x-0.5 content-start pr-2 last:pr-0 whitespace-nowrap">
                                <div className="sticky top-0 z-10 w-full bg-[#141416]">
                                    <div className="px-2 py-1.5 text-[8px] uppercase tracking-[0.15em] font-black text-blue-500/80 border-b border-white/5">
                                        {root.rootName}
                                    </div>
                                </div>
                                {root.subgroups.map((category) => (
                                    <div key={category.fullName} className="flex flex-col">
                                        {category.depth > 0 && (
                                            <div className={`sticky left-0 z-10 bg-[#141416] ${category.depth > 0 ? 'pt-2 border-t border-white/5' : ''}`}>
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
                                                return <MenuItem key={item.id} item={item} isSelected={isSelected} globalIndex={globalIndex} onSelect={onSelect} onClose={onClose} setSelectedIndex={setSelectedIndex} setSearch={setSearch} inputRef={inputRef} />;
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    ) : (
                        sortedCategories.map((root) => (
                            <div key={root.rootName} className="flex flex-col pb-2 mb-2 last:pb-0 last:mb-0">
                                <div className="sticky top-0 z-10 w-full bg-[#141416]">
                                    <div className="px-2 py-1.5 text-[8px] uppercase tracking-[0.15em] font-black text-blue-500/80 border-b border-white/5">
                                        {root.rootName}
                                    </div>
                                </div>
                                {root.subgroups.map((category) => (
                                    <div key={category.fullName} className="flex flex-col mb-1 last:mb-0">
                                        {category.depth > 0 && (
                                            <div className="px-2 py-1 text-[7px] uppercase tracking-widest font-bold text-zinc-500 flex items-center gap-2 mb-0.5">
                                                <div className="w-1 h-1 bg-zinc-700 rounded-full" />
                                                {category.displayName}
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-0.5 ml-1">
                                            {category.items.map((item) => {
                                                const globalIndex = filteredItems.indexOf(item);
                                                const isSelected = globalIndex === selectedIndex;
                                                return <MenuItem key={item.id} item={item} isSelected={isSelected} globalIndex={globalIndex} onSelect={onSelect} onClose={onClose} setSelectedIndex={setSelectedIndex} setSearch={setSearch} inputRef={inputRef} />;
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer / Hint */}
                <div className="px-2 py-0.5 text-[8px] text-zinc-600 bg-black/40 border-t border-white/5 flex justify-between uppercase tracking-tighter rounded-b-[calc(var(--radius-lg)-1px)]">
                    <span>↑↓ Navigate</span>
                    <span>Ctrl+Enter Multi</span>
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
    inputRef: React.RefObject<HTMLInputElement | null>;
}

function MenuItem({ item, isSelected, globalIndex, onSelect, onClose, setSelectedIndex, setSearch, inputRef }: MenuItemProps) {
    return (
        <button
            key={`${item.category}-${item.id}-${item.label}`}
            data-selected={isSelected}
            className={`min-w-[120px] text-left px-2 py-1 text-[10px] flex items-center justify-between group transition-colors relative rounded ${isSelected
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
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
            onMouseEnter={() => setSelectedIndex(globalIndex)}
        >
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {item.icon && <span className={isSelected ? 'opacity-100' : 'opacity-40'}>{item.icon}</span>}
                <span className="truncate">{item.label}</span>
            </div>
            <span className={`text-[7px] uppercase px-1 rounded-[1px] font-mono tracking-tighter ${isSelected ? 'bg-white/20 text-white' : 'text-zinc-600 group-hover:text-zinc-500'
                }`}>
                {item.id}
            </span>
        </button>
    );
}
