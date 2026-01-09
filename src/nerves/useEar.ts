import { useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';

/**
 * useEar (Sensory Nerve)
 * 
 * Responsibility: Listens to the outside world (Keyboard interactions, Mouse position).
 * It triggers the 'Hands' to perform actions based on what it hears.
 * 
 * DESIGN: SENSORY ONLY. Should not contain any movement or state logic.
 */

interface Eyes {
    focus: (nodes?: any[]) => void;
}

interface Hands {
    grabAll: () => void;
    grab: (pos: { x: number, y: number }) => boolean;
    discard: () => void;
    copy: () => void;
    cut: () => void;
    paste: (position: { x: number; y: number }) => any[] | undefined;
    duplicate: (position: { x: number; y: number }) => any[] | undefined;
    toggleMute: () => void;
    layoutGraph: () => void;
}

interface UseEarProps {
    hands: Hands;
    eyes: Eyes;
    memories: any;
    onOpenMenu: (position: { x: number; y: number }) => void;
}

export const useEar = ({ hands, eyes, memories, onOpenMenu }: UseEarProps) => {
    const { getNodes } = useReactFlow();
    const mousePosRef = useRef({ x: 0, y: 0 });
    const [keys, setKeys] = useState({
        shift: false,
        alt: false,
        ctrl: false, // Track Ctrl for multi-select logic elsewhere if needed
        isMuting: false,
    });

    // --- Mouse Tracking ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // --- Keyboard Listening (Ear -> Brain -> Hand) ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape: Blur Input
            if (e.code === 'Escape') {
                if (document.activeElement instanceof HTMLElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    document.activeElement.blur();
                    e.preventDefault();
                    return;
                }
            }

            if (e.key === 'Shift') setKeys(k => ({ ...k, shift: true }));
            if (e.key === 'Alt') setKeys(k => ({ ...k, alt: true }));
            if (e.key === 'Control' || e.key === 'Meta') setKeys(k => ({ ...k, ctrl: true }));

            // Global Ignore for Inputs
            if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                return;
            }

            // Shift + A: Open Add Menu
            if (e.shiftKey && e.code === 'KeyA') {
                e.preventDefault();
                onOpenMenu(mousePosRef.current);
                return;
            }

            // A: Select All -> Grab All
            if (e.code === 'KeyA' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                hands.grabAll();
                return;
            }

            // Period (.): Focus Selected
            if (e.key === '.' || e.code === 'Period') {
                e.preventDefault();
                const selected = getNodes().filter(n => n.selected);
                eyes.focus(selected);
                return;
            }

            // Delete / Backspace / X
            if ((e.code === 'KeyX' && !e.ctrlKey) || e.code === 'Delete' || e.code === 'Backspace') {
                e.preventDefault();
                hands.discard();
                return;
            }

            // Ctrl + C: Copy
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
                e.preventDefault();
                hands.copy();
                return;
            }

            // Ctrl + X: Cut
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX') {
                e.preventDefault();
                hands.cut();
                return;
            }

            // Ctrl + V: Paste
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
                e.preventDefault();
                hands.paste(mousePosRef.current);
                return;
            }

            // Shift + D: Duplicate
            if (e.shiftKey && e.code === 'KeyD') {
                e.preventDefault();
                hands.duplicate(mousePosRef.current);
                return;
            }

            // Ctrl + Z: Undo
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                memories.undo();
                return;
            }

            // Ctrl + Shift + Z OR Ctrl + Y: Redo
            if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ') ||
                ((e.ctrlKey || e.metaKey) && e.code === 'KeyY')) {
                e.preventDefault();
                memories.redo();
                return;
            }

            // M: Mute
            // M: Mute
            if (e.code === 'KeyM') {
                e.preventDefault();
                setKeys(k => ({ ...k, isMuting: true }));
                hands.toggleMute();
                return;
            }

            // G: Grab (Motor action triggered by sensory impulse)
            if (e.code === 'KeyG') {
                e.preventDefault();
                hands.grab(mousePosRef.current);
            }

            // Shift + F: Fit View
            if (e.shiftKey && e.code === 'KeyF') {
                e.preventDefault();
                const selected = getNodes().filter(n => n.selected);
                eyes.focus(selected);
                return;
            }

            // Shift + L: Auto Layout (Elk)
            if (e.shiftKey && e.code === 'KeyL') {
                e.preventDefault();
                hands.layoutGraph();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'KeyM') setKeys(k => ({ ...k, isMuting: false }));
            if (e.key === 'Shift') setKeys(k => ({ ...k, shift: false }));
            if (e.key === 'Alt') setKeys(k => ({ ...k, alt: false }));
            if (e.key === 'Control' || e.key === 'Meta') setKeys(k => ({ ...k, ctrl: false }));
        };
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [hands, eyes, getNodes, memories, onOpenMenu]); // Closing useEffect and dependency array

    return {
        mousePosition: mousePosRef.current,
        keys,
    };
};
