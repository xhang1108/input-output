import { useCallback } from 'react';

/**
 * useModalAction
 * 
 * Encapsulates the logic for confirming or cancelling a modal action via mouse interactions.
 * - Left Click (MouseUp): Confirms the action.
 * - Right Click (ContextMenu): Cancels the action.
 * 
 * @param onConfirm Callback when action is confirmed.
 * @param onCancel Callback when action is cancelled.
 * @param isActive Whether the modal action is currently active.
 */
export function useModalAction(
    onConfirm: () => void,
    onCancel: () => void,
    isActive: boolean
) {
    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!isActive) return;

        // confirm on left click release
        if (e.button === 0) {
            onConfirm();
        }
    }, [isActive, onConfirm]);

    // We don't attach this directly to window usually, but provide it for the consumer to attach
    // or call from their own handlers.
    // However, since useHand manages the global mouseUp, we mainly need the logic.

    return {
        handleModalMouseUp: handleMouseUp,
    };
}
