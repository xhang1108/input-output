/**
 * Reactive shared state for capsule handle live preview.
 * Uses useSyncExternalStore pattern for React-compatible reactivity.
 * 
 * When a new wire is being dragged toward a capsule handle,
 * this store tells MagneticEdge how to shift existing wires
 * to make room for the pending insertion.
 *
 * Subscriptions are keyed (nodeId + handleId, or nodeId) so a preview
 * change wakes only the edges/handles that can actually see it instead
 * of every mounted MagneticEdge (~500 on a large graph).
 */
import { useCallback, useSyncExternalStore } from 'react';

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

type Subscriber = () => void;

const KEY_SEP = '\u0000';
const keyOf = (nodeId: string, handleId: string) => `${nodeId}${KEY_SEP}${handleId}`;

/** Per handle-key subscribers: `${nodeId}\0${handleId}` -> callbacks */
const _targetSubs = new Map<string, Set<Subscriber>>();
/** Per node subscribers: nodeId -> callbacks */
const _nodeSubs = new Map<string, Set<Subscriber>>();
/**
 * Legacy broad subscribers (useCapsulePreview). Kept only so CapsuleHandle
 * still re-renders; edges and BaseNode use the keyed hooks instead.
 */
const _globalSubs = new Set<Subscriber>();

function addSub(
    map: Map<string, Set<Subscriber>>,
    key: string,
    callback: Subscriber
): () => void {
    let subs = map.get(key);
    if (!subs) {
        subs = new Set();
        map.set(key, subs);
    }
    subs.add(callback);
    return () => {
        const set = map.get(key);
        if (!set) return;
        set.delete(callback);
        if (set.size === 0) map.delete(key);
    };
}

function notifyKey(key: string) {
    const subs = _targetSubs.get(key);
    if (!subs || subs.size === 0) return;
    for (const cb of [...subs]) cb();
}

function notifyNode(nodeId: string) {
    const subs = _nodeSubs.get(nodeId);
    if (!subs || subs.size === 0) return;
    for (const cb of [...subs]) cb();
}

/**
 * Notify only the subscribers whose derived value changed between two snapshots.
 * A key's value changes when it was active before or is active now; likewise
 * for nodes. Every other key still maps to EMPTY and must not be woken.
 */
function notifyTransition(prev: CapsulePreviewSnapshot, next: CapsulePreviewSnapshot) {
    const keys = new Set<string>();
    const nodes = new Set<string>();

    if (prev.active) {
        keys.add(keyOf(prev.nodeId, prev.handleId));
        nodes.add(prev.nodeId);
    }
    if (next.active) {
        keys.add(keyOf(next.nodeId, next.handleId));
        nodes.add(next.nodeId);
    }

    for (const key of keys) notifyKey(key);
    for (const nodeId of nodes) notifyNode(nodeId);

    // Compatibility path for useCapsulePreview (CapsuleHandle). Remove once
    // that component moves to useCapsulePreviewForTarget.
    for (const cb of [..._globalSubs]) cb();
}

/** Subscribe to preview state changes for one node/handle key */
function subscribeTarget(nodeId: string, handleId: string, callback: Subscriber): () => void {
    return addSub(_targetSubs, keyOf(nodeId, handleId), callback);
}

/** Subscribe to preview state changes for one node (any handle) */
function subscribeNode(nodeId: string, callback: Subscriber): () => void {
    return addSub(_nodeSubs, nodeId, callback);
}

/** Subscribe to all preview state changes (legacy, broad) */
function subscribeAll(callback: Subscriber): () => void {
    _globalSubs.add(callback);
    return () => _globalSubs.delete(callback);
}

function getTargetSnapshot(nodeId: string, handleId: string): CapsulePreviewSnapshot {
    return _snapshot.active && _snapshot.nodeId === nodeId && _snapshot.handleId === handleId
        ? _snapshot
        : EMPTY;
}

function getNodeSnapshot(nodeId: string): CapsulePreviewSnapshot {
    return _snapshot.active && _snapshot.nodeId === nodeId ? _snapshot : EMPTY;
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
    if (_snapshot.active && _snapshot.nodeId === nodeId && _snapshot.handleId === handleId
        && _snapshot.slotIndex === slotIndex && _snapshot.totalSlots === totalSlots) {
        return;
    }
    const prev = _snapshot;
    _snapshot = { active: true, nodeId, handleId, slotIndex, totalSlots };
    notifyTransition(prev, _snapshot);
}

/** Called when dragging stops or snapping moves away from capsule */
function clear() {
    if (!_snapshot.active) return;
    if (_clearTimeout) clearTimeout(_clearTimeout);
    // Delay clear so that onConnect (which fires *after* mouseup) can still read the snapshot
    _clearTimeout = setTimeout(() => {
        const prev = _snapshot;
        _snapshot = EMPTY;
        _clearTimeout = null;
        notifyTransition(prev, EMPTY);
    }, 50);
}

export const capsulePreviewState = { set, clear, getSnapshot };

/** React hook to reactively read the capsule preview state */
export function useCapsulePreview(): CapsulePreviewSnapshot {
    return useSyncExternalStore(subscribeAll, getSnapshot);
}

/** React hook notified only when the preview on this exact node/handle changes */
export function useCapsulePreviewForTarget(
    nodeId: string,
    handleId: string
): CapsulePreviewSnapshot {
    const subscribe = useCallback(
        (callback: Subscriber) => subscribeTarget(nodeId, handleId, callback),
        [nodeId, handleId]
    );
    const getSnapshotForTarget = useCallback(
        () => getTargetSnapshot(nodeId, handleId),
        [nodeId, handleId]
    );
    return useSyncExternalStore(subscribe, getSnapshotForTarget);
}

/** React hook notified only when the preview on this node changes (any handle) */
export function useCapsulePreviewForNode(nodeId: string): CapsulePreviewSnapshot {
    const subscribe = useCallback(
        (callback: Subscriber) => subscribeNode(nodeId, callback),
        [nodeId]
    );
    const getSnapshotForNode = useCallback(() => getNodeSnapshot(nodeId), [nodeId]);
    return useSyncExternalStore(subscribe, getSnapshotForNode);
}

/** @internal Raw keyed subscriptions, exported for tests */
export const capsulePreviewSubscriptions = {
    target: subscribeTarget,
    node: subscribeNode,
};
