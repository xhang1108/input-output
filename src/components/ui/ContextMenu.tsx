import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
    label: string;
    action: () => void;
    shortcut?: string;
    danger?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Simple bound check to keep menu in viewport (basic implementation)
    // We can enhance this later if needed.
    const style = {
        top: y,
        left: x,
    };

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-48 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col py-1"
            style={style}
            onContextMenu={(e) => e.preventDefault()} // Prevent browser menu on top of ours
        >
            {items.map((item, index) => (
                <button
                    key={index}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between group hover:bg-zinc-800 ${item.danger ? 'text-red-400 hover:text-red-300' : 'text-zinc-300 hover:text-white'
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        item.action();
                        onClose();
                    }}
                >
                    <span>{item.label}</span>
                    {item.shortcut && (
                        <span className="text-zinc-600 text-[10px] group-hover:text-zinc-500">
                            {item.shortcut}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}
