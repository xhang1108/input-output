/**
 * @vitest-environment jsdom
 *
 * Floating undo/redo affordance: disabled state must track history availability
 * (and read-only), and disabled buttons must never invoke their handlers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UndoRedoControls } from '@/components/ui/UndoRedoControls';

function renderControls(overrides: Partial<ComponentProps<typeof UndoRedoControls>> = {}) {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const props = {
        canUndo: true,
        canRedo: true,
        onUndo,
        onRedo,
        ...overrides,
    };
    render(<UndoRedoControls {...props} />);
    return { onUndo, onRedo };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('UndoRedoControls', () => {
    it('renders both buttons with accessible names', () => {
        renderControls();

        expect(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Redo (Ctrl+Y)' })).toBeTruthy();
    });

    it('disables each button when its history side is empty', () => {
        renderControls({ canUndo: false, canRedo: false });

        const undo = screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }) as HTMLButtonElement;
        const redo = screen.getByRole('button', { name: 'Redo (Ctrl+Y)' }) as HTMLButtonElement;

        expect(undo.disabled).toBe(true);
        expect(redo.disabled).toBe(true);
    });

    it('keeps the undo button enabled while redo is unavailable', () => {
        renderControls({ canUndo: true, canRedo: false });

        const undo = screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }) as HTMLButtonElement;
        const redo = screen.getByRole('button', { name: 'Redo (Ctrl+Y)' }) as HTMLButtonElement;

        expect(undo.disabled).toBe(false);
        expect(redo.disabled).toBe(true);
    });

    it('fires onUndo and onRedo on click', () => {
        const { onUndo, onRedo } = renderControls();

        fireEvent.click(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }));
        expect(onUndo).toHaveBeenCalledTimes(1);
        expect(onRedo).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Redo (Ctrl+Y)' }));
        expect(onRedo).toHaveBeenCalledTimes(1);
        expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('does not call handlers when the disabled buttons are clicked', () => {
        const { onUndo, onRedo } = renderControls({ canUndo: false, canRedo: false });

        fireEvent.click(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Redo (Ctrl+Y)' }));

        expect(onUndo).not.toHaveBeenCalled();
        expect(onRedo).not.toHaveBeenCalled();
    });

    it('disables both buttons when the disabled prop is set, even with history', () => {
        const { onUndo, onRedo } = renderControls({ canUndo: true, canRedo: true, disabled: true });

        const undo = screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }) as HTMLButtonElement;
        const redo = screen.getByRole('button', { name: 'Redo (Ctrl+Y)' }) as HTMLButtonElement;

        expect(undo.disabled).toBe(true);
        expect(redo.disabled).toBe(true);

        fireEvent.click(undo);
        fireEvent.click(redo);

        expect(onUndo).not.toHaveBeenCalled();
        expect(onRedo).not.toHaveBeenCalled();
    });
});
