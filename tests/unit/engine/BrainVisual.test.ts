import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Brain } from '@/engine/Brain';
import { NodeRegistry } from '@/engine/NodeRegistry';

vi.useFakeTimers();

// Polyfill performance.now() for test environment using fake clock
const mockNow = vi.spyOn(global, 'performance' as any, 'get').mockReturnValue({
    now: () => Date.now()
} as Performance);

describe('Brain Visual Isolation', () => {
    let brain: Brain;

    beforeEach(async () => {
        vi.setSystemTime(0);
        brain = Brain.getInstance();
        // Reset state using supported injectNodes(..., true)
        await brain.injectNodes({ nodes: [], edges: [] }, true);
        brain.resetHeartbeat();
        NodeRegistry.initializeNodes();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    it('should initialize nodes with a default visual state on first heartbeat', () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: { id: 'test-node', type: 'MA-01' }
        });

        vi.advanceTimersByTime(20);

        const node = brain.getNodesMap().get('test-node');
        expect(node?.visualState).toBeDefined();
        expect(node?.visualState?.muted).toBe(false);
        // visualTick is now time-based, just verify it's a number >= 0
        expect(typeof node?.visualState?.visualTick).toBe('number');
    });

    it('should increment visualTick over time (time-based tick)', () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: { id: 'tick-node', type: 'MA-01' }
        });

        vi.advanceTimersByTime(20);
        const tick1 = brain.getNodesMap().get('tick-node')?.visualState?.visualTick ?? 0;

        // Advance enough time that the tick counter changes (> 16.67ms per unit)
        vi.advanceTimersByTime(200);
        const tick2 = brain.getNodesMap().get('tick-node')?.visualState?.visualTick ?? 0;

        // tick2 should differ from tick1 after time advances
        expect(tick2).not.toBe(tick1);
    });

    it('should sync muted state from node data', () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: { id: 'mute-node', type: 'MA-01', data: { muted: true } }
        });

        vi.advanceTimersByTime(20);
        const node = brain.getNodesMap().get('mute-node');
        expect(node?.visualState?.muted).toBe(true);

        // Update data
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id: 'mute-node', data: { muted: false } }
        });

        // Next heartbeat should sync the muted state
        vi.advanceTimersByTime(20);
        expect(brain.getNodesMap().get('mute-node')?.visualState?.muted).toBe(false);
    });
});

