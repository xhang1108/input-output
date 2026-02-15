'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';
import { getDefinitionsByCategory } from '../../definitions/nodeDefinitions';

interface CommandPaletteProps {
    isOpen: boolean;
    position?: { x: number, y: number };
    onClose: () => void;
    onSelect: (type: string, label: string, data?: any) => void;
    pendingConnection?: { nodeId: string; handleId: string | null; handleType: 'source' | 'target' } | null;
}

// Transform NodeDefinitions → Menu format
function buildMenuItems() {
    return getDefinitionsByCategory().map(({ category, items }) => ({
        category,
        items: items.map(def => ({
            label: def.label,
            type: def.id,
            data: {
                ...def.defaultData,
                handles: def.handles,
            }
        }))
    }));
}

const MENU_ITEMS = buildMenuItems();

export function CommandPalette({ isOpen, position, onClose, onSelect, pendingConnection }: CommandPaletteProps) {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Flatten items for search/navigation
    const flattenedItems = useMemo(() => {
        let items = MENU_ITEMS.flatMap(cat =>
            cat.items.map(item => ({ ...item, category: cat.category }))
        );

        // Filter by Pending Connection (Smart Link)
        if (pendingConnection) {
            const requiredHandleType = pendingConnection.handleType === 'source' ? 'target' : 'source';
            console.log('Filtering for:', requiredHandleType);

            items = items.filter(item => {
                // Check if node definition has a compatible handle
                const nodeHandles = item.data.handles || [];
                const hasCompatibleHandle = nodeHandles.some((h: any) => h.type === requiredHandleType);
                return hasCompatibleHandle;
            });
        }

        // Filter by Search Term
        return items.filter(item =>
            item.label.toLowerCase().includes(search.toLowerCase())
        );
    }, [search, pendingConnection]);

    useEffect(() => {
        if (isOpen) {
            console.log('CommandPalette MOUNTED/OPENED at:', position);
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, position]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [search]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, flattenedItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flattenedItems[selectedIndex]) {
                const item = flattenedItems[selectedIndex];
                onSelect(item.type, item.label, item.data);
                onClose();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed z-10000 w-56 bg-(--node-bg) border border-(--node-border) rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col"
            style={{
                left: position?.x ?? '50%',
                top: position?.y ?? '50%',
                maxHeight: '400px'
            }}
            onClick={e => e.stopPropagation()}
        >
            <div className="p-2 border-b border-(--node-border)">
                <div className="flex items-center px-2 py-1 bg-zinc-950 rounded border border-(--node-border)">
                    <Search className="w-3 h-3 text-zinc-500 mr-2" />
                    <input
                        ref={inputRef}
                        className="bg-transparent text-xs text-zinc-200 outline-none w-full placeholder-zinc-600"
                        placeholder="Search..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                </div>
            </div>

            <div className="overflow-y-auto py-1 max-h-[inherit] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {flattenedItems.length === 0 ? (
                    <div className="px-4 py-2 text-zinc-500 text-xs text-center">No nodes found</div>
                ) : (
                    Object.entries(
                        flattenedItems.reduce((acc, item) => {
                            if (!acc[item.category]) acc[item.category] = [];
                            acc[item.category].push(item);
                            return acc;
                        }, {} as Record<string, typeof flattenedItems>)
                    ).map(([category, items]) => (
                        <div key={category} className="mb-1">
                            {/* Category Header */}
                            <div className="px-3 py-1 text-[9px] uppercase tracking-wider font-bold text-zinc-500 bg-zinc-900/50 flex items-center gap-2">
                                <span className="h-px flex-1 bg-zinc-800" />
                                {category}
                                <span className="h-px flex-1 bg-zinc-800" />
                            </div>

                            {/* Category Items */}
                            {items.map((item) => {
                                // Find global index for highlight/selection logic
                                const globalIndex = flattenedItems.indexOf(item);
                                return (
                                    <button
                                        key={`${item.type}-${item.label}`}
                                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between group transition-colors ${globalIndex === selectedIndex
                                                ? 'bg-blue-600/90 text-white shadow-sm'
                                                : 'text-zinc-300 hover:bg-zinc-800'
                                            }`}
                                        onClick={() => {
                                            onSelect(item.type, item.label, item.data);
                                            onClose();
                                        }}
                                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                                    >
                                        <span className="flex-1">{item.label}</span>
                                        <span className={`text-[8px] opacity-40 font-mono ${globalIndex === selectedIndex ? 'text-blue-100' : 'text-zinc-500'
                                            }`}>
                                            {item.type}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
