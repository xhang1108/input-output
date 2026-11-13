import { useEffect, useState, useCallback } from 'react';
import { useBrain } from '../../context/BrainContext';
import { Brain } from '../../engine/Brain';

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
 * 1. Key Tracking: Maintains the set of currently held keys; the returned
 *    isPressed('key') queries that set (no caller yet, kept for future use).
 * 2. Shortcut Dispatching: Provide a mapping to execute commands on key combinations.
 * 3. Biological Input Guard: Automatically ignores shortcuts when typing in inputs.
 * 4. Shortcut Scope Guard: Ignores keys inside [aria-modal="true"] or
 *    [data-shortcut-scope="off"] scopes, except Escape.
 */
export function useEar(props: EarProps = {}) {
    const brain = useBrain();
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

        // 2. Guard: Ignore auto-repeat of modified combos only.
        // Single-key shortcuts (m/x/g/y/digits/Backspace) rely on repeated
        // keydown accumulation, so plain repeats must still flow through.
        if (e.repeat && (e.ctrlKey || e.metaKey || e.altKey)) {
            return;
        }

        // 3. Guard: Ignore keys inside modal / opt-out shortcut scopes
        // (e.target may be document or window, so closest() must be probed).
        const targetEl = e.target as Element | null;
        const scopeHost = typeof targetEl?.closest === 'function'
            ? targetEl.closest('[aria-modal="true"], [data-shortcut-scope="off"]')
            : null;
        if (scopeHost && e.key !== 'Escape') {
            return;
        }

        // 4. State Update (isPressed logic)
        setKeys(prev => {
            const newKeys = new Set(prev);
            newKeys.add(e.key.toLowerCase());
            return newKeys;
        });

        // 5. Delegate to callback
        if (onKeyDown) {
            onKeyDown(e);
        }

        // 6. Shortcut Dispatching (The "Brain" part of the ear)
        if (shortcuts) {
            const key = e.key.toLowerCase();
            const modifiers = [];
            if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
            if (e.shiftKey) modifiers.push('shift');
            if (e.altKey) modifiers.push('alt');

            const comboKey = modifiers.length > 0
                ? `${modifiers.sort().join('+')}+${key}`
                : key;

            // Native copy must win when the user has selected text: skip the
            // shortcut entirely and leave the event (and its default) untouched.
            if (comboKey === 'ctrl+c' && (window.getSelection()?.toString() ?? '').length > 0) {
                return;
            }

            const match = shortcuts[comboKey] || (modifiers.length === 0 ? shortcuts[key] : undefined);

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


