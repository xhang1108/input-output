import { useEffect, useState, useCallback } from 'react';
import { Brain } from '../engine/Brain';

type HotkeyAction = (e: KeyboardEvent) => void;

export interface HotkeyMapping {
    [keys: string]: HotkeyAction | {
        action: HotkeyAction;
        disabled?: boolean;
    };
}

type EarProps = {
    shortcuts?: HotkeyMapping;
    onKeyDown?: (e: KeyboardEvent) => void;
    onKeyUp?: (e: KeyboardEvent) => void;
    deps?: unknown[];
};

/**
 * useEar - The primary keyboard nerve of Input-Output.
 * 
 * Functions:
 * 1. Key Tracking: Use isPressed('key') to check current state.
 * 2. Shortcut Dispatching: Provide a mapping to execute commands on key combinations.
 * 3. Biological Input Guard: Automatically ignores shortcuts when typing in inputs.
 */
export function useEar(props: EarProps = {}) {

    const [keys, setKeys] = useState<Set<string>>(new Set());
    const { shortcuts, onKeyDown, onKeyUp, deps = [] } = props;

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // 1. Guard: Skip if user is typing in an input (except for Escape)
        const activeElement = document.activeElement;
        const isInputActive = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.getAttribute('contenteditable') === 'true'
        );

        if (isInputActive && e.key !== 'Escape') {
            return;
        }

        // 2. State Update (isPressed logic)
        setKeys(prev => {
            const newKeys = new Set(prev);
            newKeys.add(e.key.toLowerCase());
            return newKeys;
        });

        // 3. Delegate to callback
        if (onKeyDown) {
            onKeyDown(e);
        }

        // 4. Shortcut Dispatching (The "Brain" part of the ear)
        if (shortcuts) {
            const key = e.key.toLowerCase();
            const modifiers = [];
            if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
            if (e.shiftKey) modifiers.push('shift');
            if (e.altKey) modifiers.push('alt');

            const comboKey = modifiers.length > 0
                ? `${modifiers.sort().join('+')}+${key}`
                : key;

            const match = shortcuts[comboKey] || (modifiers.length === 0 ? shortcuts[key] : undefined);

            // Undo (Ctrl+Z)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                Brain.getInstance().undo();
                return;
            }

            // Redo (Ctrl+Y or Ctrl+Shift+Z)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                Brain.getInstance().redo();
                return;
            }

            if (match) {
                const isFunction = typeof match === 'function';
                const action = isFunction ? match : match.action;
                const disabled = !isFunction && match.disabled;

                if (!disabled) {
                    action(e);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onKeyDown, shortcuts, ...deps]);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        setKeys(prev => {
            const newKeys = new Set(prev);
            newKeys.delete(e.key.toLowerCase());
            return newKeys;
        });

        if (onKeyUp) {
            onKeyUp(e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onKeyUp, ...deps]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

    return {
        isPressed: (key: string) => keys.has(key.toLowerCase()),
    };
}

