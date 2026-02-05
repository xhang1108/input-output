import { useEffect, useState } from 'react';

type KeyState = {
    key: string;
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
};

type EarProps = {
    onKeyDown?: (e: KeyboardEvent) => void;
    onKeyUp?: (e: KeyboardEvent) => void;
};

export function useEar(props?: EarProps) {
    const [keys, setKeys] = useState<Set<string>>(new Set());

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Control Inversion: Ignore if input is focused
            const activeElement = document.activeElement;
            const isInputActive = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.getAttribute('contenteditable') === 'true'
            );

            if (isInputActive && e.key !== 'Escape') {
                return;
            }

            setKeys(prev => {
                const newKeys = new Set(prev);
                newKeys.add(e.key.toLowerCase());
                return newKeys;
            });

            if (props?.onKeyDown) {
                props.onKeyDown(e);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            setKeys(prev => {
                const newKeys = new Set(prev);
                newKeys.delete(e.key.toLowerCase());
                return newKeys;
            });

            if (props?.onKeyUp) {
                props.onKeyUp(e);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [props]);

    return {
        isPressed: (key: string) => keys.has(key.toLowerCase()),
    };
}
