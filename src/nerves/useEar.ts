import { useEffect, useState, useCallback } from 'react';

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
    deps?: any[];
};

/**
 * useEar - The primary keyboard nerve of Calctopus.
 * 
 * Functions:
 * 1. Key Tracking: Use isPressed('key') to check current state.
 * 2. Shortcut Dispatching: Provide a mapping to execute commands on key combinations.
 * 3. Biological Input Guard: Automatically ignores shortcuts when typing in inputs.
 */
export function useEar(props: EarProps = {}) {
    const [keys, setKeys] = useState<Set<string>>(new Set());

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
        if (props.onKeyDown) {
            props.onKeyDown(e);
        }

        // 4. Shortcut Dispatching (The "Brain" part of the ear)
        if (props.shortcuts) {
            const key = e.key.toLowerCase();
            const modifiers = [];
            if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
            if (e.shiftKey) modifiers.push('shift');
            if (e.altKey) modifiers.push('alt');

            const comboKey = modifiers.length > 0
                ? `${modifiers.sort().join('+')}+${key}`
                : key;

            const match = props.shortcuts[comboKey] || (modifiers.length === 0 ? props.shortcuts[key] : undefined);

            if (match) {
                const isFunction = typeof match === 'function';
                const action = isFunction ? match : match.action;
                const disabled = !isFunction && match.disabled;

                if (!disabled) {
                    action(e);
                }
            }
        }
    }, props.deps || []);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        setKeys(prev => {
            const newKeys = new Set(prev);
            newKeys.delete(e.key.toLowerCase());
            return newKeys;
        });

        if (props.onKeyUp) {
            props.onKeyUp(e);
        }
    }, props.deps || []);

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
