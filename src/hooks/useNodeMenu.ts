import { useState, useCallback } from 'react';

/**
 * A custom hook to manage the state and trigger logic for the node CategoryMenu.
 * Centralizes the `menuOpen`, `menuPos`, `trigger` states and the `handleTrigger` function,
 * ensuring consistent alignment and behavior across all nodes.
 */
export function useNodeMenu() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const [trigger, setTrigger] = useState<HTMLElement | null>(null);

    const handleTrigger = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const button = e.currentTarget as HTMLElement;
        const container = button.closest('.group') as HTMLElement;
        const el = container || button;

        const rect = el.getBoundingClientRect();
        setMenuPos({ x: rect.left, y: rect.bottom });
        setTrigger(el);
        setMenuOpen(true);
    }, []);

    const closeMenu = useCallback(() => {
        setMenuOpen(false);
    }, []);

    return {
        menuOpen,
        menuPos,
        trigger,
        handleTrigger,
        closeMenu
    };
}
