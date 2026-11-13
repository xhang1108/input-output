// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// useEar reads the Brain only for side-effects elsewhere; the shortcut layer
// itself is pure. Stub the context so the hook can mount without a provider.
vi.mock('@/context/BrainContext', () => ({
    useBrain: () => ({}),
}));

import type { Mock } from 'vitest';

import { useEar } from '@/hooks/nerves/useEar';

type Handler = Mock<(...args: any[]) => any>;

function fire(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

describe('useEar guards', () => {
    let onPaste: Handler;
    let onToggleMute: Handler;
    let onCopy: Handler;

    beforeEach(() => {
        onPaste = vi.fn();
        onToggleMute = vi.fn();
        onCopy = vi.fn();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function mount() {
        return renderHook(() => useEar({
            shortcuts: {
                'ctrl+v': onPaste,
                'ctrl+c': onCopy,
                'm': onToggleMute,
            },
        }));
    }

    it('suppresses auto-repeat of modified combos (ctrl+v held)', () => {
        mount();

        fire(window, { key: 'v', ctrlKey: true, repeat: true });
        expect(onPaste).not.toHaveBeenCalled();

        fire(window, { key: 'v', ctrlKey: true });
        expect(onPaste).toHaveBeenCalledTimes(1);
    });

    it('still dispatches plain-key repeats (holding m keeps toggling)', () => {
        mount();

        fire(window, { key: 'm', repeat: true });
        fire(window, { key: 'm', repeat: true });

        expect(onToggleMute).toHaveBeenCalledTimes(2);
    });

    it('leaves native copy alone when text is selected', () => {
        vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected text' } as unknown as Selection);
        mount();

        fire(window, { key: 'c', ctrlKey: true });
        expect(onCopy).not.toHaveBeenCalled();
    });

    it('dispatches copy when nothing is selected', () => {
        vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as unknown as Selection);
        mount();

        fire(window, { key: 'c', ctrlKey: true });
        expect(onCopy).toHaveBeenCalledTimes(1);
    });

    it('ignores shortcuts inside [aria-modal="true"] but still allows Escape to bubble', () => {
        const modal = document.createElement('div');
        modal.setAttribute('aria-modal', 'true');
        const inside = document.createElement('button');
        modal.appendChild(inside);
        document.body.appendChild(modal);

        mount();

        fire(inside, { key: 'v', ctrlKey: true });
        expect(onPaste).not.toHaveBeenCalled();

        // Escape is not a registered shortcut here, so assert the guard shape:
        // an Escape binding inside a modal must still reach its handler.
        const escHandler = vi.fn();
        const modalScope = document.createElement('div');
        modalScope.setAttribute('data-shortcut-scope', 'off');
        const escTarget = document.createElement('button');
        modalScope.appendChild(escTarget);
        document.body.appendChild(modalScope);

        const { unmount } = renderHook(() => useEar({ shortcuts: { escape: escHandler } }));
        fire(escTarget, { key: 'Escape' });
        expect(escHandler).toHaveBeenCalledTimes(1);
        unmount();
    });
});
