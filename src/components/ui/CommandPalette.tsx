'use client';

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Position } from '@xyflow/react';

interface CommandPaletteProps {
    isOpen: boolean;
    position?: { x: number, y: number };
    onClose: () => void;
    onSelect: (type: string, label: string, data?: any) => void;
}

const MENU_ITEMS = [
    {
        category: 'Input', items: [
            { label: 'Number', type: 'baseNode', data: { type: 'number' } },
            { label: 'Slider', type: 'baseNode', data: { type: 'slider' } },
            { label: 'Toggle', type: 'baseNode', data: { type: 'toggle' } },
        ]
    },
    {
        category: 'Math', items: [
            { label: 'Add (+)', type: 'baseNode', data: { type: 'add' } },
            { label: 'Subtract (-)', type: 'baseNode', data: { type: 'sub' } },
            { label: 'Multiply (*)', type: 'baseNode', data: { type: 'mul' } },
            { label: 'Divide (/)', type: 'baseNode', data: { type: 'div' } },
        ]
    },
    {
        category: 'Logic', items: [
            { label: 'Result', type: 'baseNode', data: { type: 'result' } },
        ]
    },
    {
        category: 'Debug', items: [
            {
                label: 'Multi-Handle (5 Inputs)',
                type: 'baseNode',
                data: {
                    label: 'Dynamic Node',
                    handles: [
                        { id: 'in-0', type: 'target', position: Position.Left, variant: 'capsule', label: 'Main' },
                        { id: 'in-1', type: 'target', position: Position.Left, variant: 'single' },
                        { id: 'in-2', type: 'target', position: Position.Left, variant: 'single' },
                        { id: 'in-3', type: 'target', position: Position.Left, variant: 'single' },
                        { id: 'in-4', type: 'target', position: Position.Left, variant: 'single' },
                    ]
                }
            },
        ]
    },
];

export function CommandPalette({ isOpen, position, onClose, onSelect }: CommandPaletteProps) {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Flatten items for search/navigation
    const flattenedItems = MENU_ITEMS.flatMap(cat =>
        cat.items.map(item => ({ ...item, category: cat.category }))
    ).filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

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
            className="fixed z-100 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col"
            style={{
                left: position?.x ?? '50%',
                top: position?.y ?? '50%',
                maxHeight: '300px'
            }}
            onClick={e => e.stopPropagation()}
        >
            <div className="p-2 border-b border-zinc-700">
                <div className="flex items-center px-2 py-1 bg-zinc-950 rounded border border-zinc-800">
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

            <div className="overflow-y-auto py-1">
                {flattenedItems.length === 0 ? (
                    <div className="px-4 py-2 text-zinc-500 text-xs text-center">No nodes</div>
                ) : (
                    flattenedItems.map((item, index) => (
                        <button
                            key={`${item.category}-${item.label}`}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between group ${index === selectedIndex ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                                }`}
                            onClick={() => {
                                onSelect(item.type, item.label, item.data);
                                onClose();
                            }}
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            <span>{item.label}</span>
                            {/* Only show category if searching to avoid clutter in full list? Or small tag */}
                            {search && (
                                <span className={`text-[9px] px-1 py-0.5 rounded opacity-50 ${index === selectedIndex ? 'text-white' : 'text-zinc-500'
                                    }`}>
                                    {item.category}
                                </span>
                            )}
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
