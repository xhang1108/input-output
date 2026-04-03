/**
 * Reactive shared state for capsule handle live preview.
 * Uses useSyncExternalStore pattern for React-compatible reactivity.
 * 
 * When a new wire is being dragged toward a capsule handle,
 * this store tells MagneticEdge how to shift existing wires
 * to make room for the pending insertion.
 */
import { useSyncExternalStore } from 'react';

export interface CapsulePreviewSnapshot {
    active: boolean;
    nodeId: string;
    handleId: string;
    slotIndex: number;
    totalSlots: number;
}

const EMPTY: CapsulePreviewSnapshot = {
    active: false,
    nodeId: '',
    handleId: '',
    slotIndex: -1,
    totalSlots: 0,
};

let _snapshot: CapsulePreviewSnapshot = EMPTY;
const _subscribers = new Set<() => void>();

function notifyAll() {
    _subscribers.forEach(cb => cb());
}

/** Subscribe to preview state changes (for useSyncExternalStore) */
function subscribe(callback: () => void): () => void {
    _subscribers.add(callback);
    return () => _subscribers.delete(callback);
}

/** Get current snapshot (for useSyncExternalStore) */
function getSnapshot(): CapsulePreviewSnapshot {
    return _snapshot;
}

let _clearTimeout: ReturnType<typeof setTimeout> | null = null;

/** Called by RelinkLine when snapping to a capsule handle */
function set(nodeId: string, handleId: string, slotIndex: number, totalSlots: number) {
    if (_clearTimeout) {
        clearTimeout(_clearTimeout);
        _clearTimeout = null;
    }
    // Only update and notify if something actually changed
    if (!_snapshot.active || _snapshot.nodeId !== nodeId || _snapshot.handleId !== handleId
        || _snapshot.slotIndex !== slotIndex || _snapshot.totalSlots !== totalSlots) {
        _snapshot = { active: true, nodeId, handleId, slotIndex, totalSlots };
        notifyAll();
    }
}

/** Called when dragging stops or snapping moves away from capsule */
function clear() {
    if (_snapshot.active) {
        // Delay clear so that onConnect (which fires *after* mouseup) can still read the snapshot
        _clearTimeout = setTimeout(() => {
            _snapshot = EMPTY;
            notifyAll();
            _clearTimeout = null;
        }, 50);
    }
}

export const capsulePreviewState = { set, clear, getSnapshot };

/** React hook to reactively read the capsule preview state */
export function useCapsulePreview(): CapsulePreviewSnapshot {
    return useSyncExternalStore(subscribe, getSnapshot);
}

