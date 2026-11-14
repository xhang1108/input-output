/**
 * @vitest-environment jsdom
 *
 * Capsule preview fan-out: keyed subscriptions must wake only the handle key
 * (and node) that actually changed, instead of every mounted MagneticEdge.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
    capsulePreviewState,
    capsulePreviewSubscriptions,
    useCapsulePreviewForNode,
    useCapsulePreviewForTarget,
} from '@/components/edges/capsulePreviewState';

const { target: subscribeTarget, node: subscribeNode } = capsulePreviewSubscriptions;

let unsubs: Array<() => void> = [];

function track(unsub: () => void) {
    unsubs.push(unsub);
    return unsub;
}

beforeEach(() => {
    vi.useFakeTimers();
    capsulePreviewState.clear();
    vi.runAllTimers();
});

afterEach(() => {
    unsubs.forEach(fn => fn());
    unsubs = [];
    capsulePreviewState.clear();
    vi.runAllTimers();
    vi.useRealTimers();
});

describe('capsulePreviewState keyed subscriptions', () => {
    it('set() notifies only the matching handle key and node', () => {
        const n1h1 = vi.fn();
        const n1h2 = vi.fn();
        const n2h1 = vi.fn();
        const node1 = vi.fn();
        const node2 = vi.fn();

        track(subscribeTarget('n1', 'h1', n1h1));
        track(subscribeTarget('n1', 'h2', n1h2));
        track(subscribeTarget('n2', 'h1', n2h1));
        track(subscribeNode('n1', node1));
        track(subscribeNode('n2', node2));

        capsulePreviewState.set('n1', 'h1', 1, 3);

        expect(n1h1).toHaveBeenCalledTimes(1);
        expect(node1).toHaveBeenCalledTimes(1);
        expect(n1h2).not.toHaveBeenCalled();
        expect(n2h1).not.toHaveBeenCalled();
        expect(node2).not.toHaveBeenCalled();

        // Fan-out: 2 of 5 subscribers (previously 5 of 5 via notifyAll()).
        const notified = [n1h1, n1h2, n2h1, node1, node2]
            .filter(fn => fn.mock.calls.length > 0).length;
        expect(notified).toBe(2);
    });

    it('clear() keeps the 50 ms delay and notifies only the previously active key/node', () => {
        const n1h1 = vi.fn();
        const n1h2 = vi.fn();
        const node1 = vi.fn();
        const node2 = vi.fn();

        track(subscribeTarget('n1', 'h1', n1h1));
        track(subscribeTarget('n1', 'h2', n1h2));
        track(subscribeNode('n1', node1));
        track(subscribeNode('n2', node2));

        capsulePreviewState.set('n1', 'h1', 0, 2);
        vi.clearAllMocks();

        capsulePreviewState.clear();
        vi.advanceTimersByTime(49);
        expect(n1h1).not.toHaveBeenCalled();
        expect(node1).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(n1h1).toHaveBeenCalledTimes(1);
        expect(node1).toHaveBeenCalledTimes(1);
        expect(n1h2).not.toHaveBeenCalled();
        expect(node2).not.toHaveBeenCalled();
        expect(capsulePreviewState.getSnapshot().active).toBe(false);
    });

    it('getSnapshot() returns the latest snapshot; unchanged set() does not notify', () => {
        const subscriber = vi.fn();
        track(subscribeTarget('n1', 'h1', subscriber));

        capsulePreviewState.set('n1', 'h1', 0, 2);
        const first = capsulePreviewState.getSnapshot();
        expect(first).toEqual({ active: true, nodeId: 'n1', handleId: 'h1', slotIndex: 0, totalSlots: 2 });
        expect(subscriber).toHaveBeenCalledTimes(1);

        capsulePreviewState.set('n1', 'h1', 0, 2);
        expect(subscriber).toHaveBeenCalledTimes(1);
        expect(capsulePreviewState.getSnapshot()).toBe(first);

        capsulePreviewState.set('n1', 'h1', 1, 2);
        expect(subscriber).toHaveBeenCalledTimes(2);
        expect(capsulePreviewState.getSnapshot().slotIndex).toBe(1);
    });

    it('returns the shared EMPTY snapshot for non-matching keys, with stable identity', () => {
        const target = renderHook(() => useCapsulePreviewForTarget('n1', 'h1'));
        const node = renderHook(() => useCapsulePreviewForNode('n1'));

        const emptyTarget = target.result.current;
        const emptyNode = node.result.current;
        expect(emptyTarget.active).toBe(false);
        expect(emptyNode.active).toBe(false);
        // Same shared instance, not a fresh EMPTY object per render.
        expect(emptyTarget).toBe(emptyNode);

        target.rerender();
        node.rerender();
        expect(target.result.current).toBe(emptyTarget);
        expect(node.result.current).toBe(emptyNode);

        act(() => {
            capsulePreviewState.set('n1', 'h1', 0, 2);
        });
        expect(target.result.current.active).toBe(true);
        expect(node.result.current).toBe(target.result.current);

        // A surface rendering a different key must still see EMPTY.
        const other = renderHook(() => useCapsulePreviewForTarget('n1', 'h2'));
        expect(other.result.current).toBe(emptyTarget);

        act(() => {
            capsulePreviewState.clear();
            vi.advanceTimersByTime(50);
        });
        expect(target.result.current).toBe(emptyTarget);
        expect(node.result.current).toBe(emptyNode);
    });
});
