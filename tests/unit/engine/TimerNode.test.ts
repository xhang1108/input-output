import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Brain } from '@/engine/Brain';

/**
 * TimerNode Engine Logic Tests (IN-11)
 * 
 * Verifies O(K) registry management, catch-up accuracy, 
 * Reset Guard synchronization, and Overclocking support.
 */
describe('TimerNode Engine Logic (IN-11)', () => {
    let brain: any;

    beforeEach(async () => {
        vi.useFakeTimers();
        // Mock performance.now to follow the fake System Time (Date.now())
        vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
        vi.setSystemTime(1000); // Start at T=1000ms

        // Using a fresh private instance for every test to ensure absolute isolation
        brain = new (Brain as any)(`test_session_${Math.random()}`);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        if (brain) brain.dispose();
    });

    it('should register a timer node in the activeTickers set when added running', async () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'timer_1',
                type: 'IN-11',
                data: { running: true, interval: 1000, currentValue: 0, step: 1 }
            }
        });

        expect(brain.activeTickers.has('timer_1')).toBe(true);
        expect(brain.tickerStates.get('timer_1').lastTick).toBe(1000);
    });

    it('should remain inactive if added in paused state', async () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'timer_paused',
                type: 'IN-11',
                data: { running: false, interval: 1000 }
            }
        });

        expect(brain.activeTickers.has('timer_paused')).toBe(false);
    });

    it('should increment value accurately using carry-over logic', async () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'timer_1',
                type: 'IN-11',
                data: { running: true, interval: 1000, currentValue: 0, step: 1 }
            }
        });

        // 1. Advance time to T=2050 (1050ms elapsed)
        brain.processTickers(2050);
        
        const node = brain.getNodesMap().get('timer_1');
        expect(node.data.currentValue).toBe(1);
        
        // Check carry-over: lastTick should be 1000 + (1 * 1000) = 2000
        expect(brain.tickerStates.get('timer_1').lastTick).toBe(2000);
    });

    it('should handle multi-tick catch-up (Overclocking logic)', async () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'timer_1',
                type: 'IN-11',
                data: { running: true, interval: 100, currentValue: 0, step: 1 }
            }
        });

        // Current anchor is 1000.
        // Simulate a massive 550ms jump to T=1550 (should result in 5 ticks: 100, 200, ..., 500)
        brain.processTickers(1550);

        const node = brain.getNodesMap().get('timer_1');
        expect(node.data.currentValue).toBe(5);
        
        // Precision check: anchor is now 1500.
        // Advancing to T=1590 (90ms since last anchor) -> no tick.
        brain.processTickers(1590); 
        expect(brain.getNodesMap().get('timer_1').data.currentValue).toBe(5);
        
        // Advancing to T=1610 (110ms since last anchor) -> tick to 6.
        brain.processTickers(1610); 
        expect(brain.getNodesMap().get('timer_1').data.currentValue).toBe(6);
    });

    it('should implement the Reset Guard to prevent value bursts after manual reset', async () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'timer_1',
                type: 'IN-11',
                data: { running: true, interval: 1000, currentValue: 0, initialValue: 0 }
            }
        });

        // 1. Advance time to T=1999 (999ms elapsed) -> No tick yet
        brain.processTickers(1999);
        expect(brain.getNodesMap().get('timer_1').data.currentValue).toBe(0);

        // 2. Advance to T=2500 (1500ms total elapsed)
        brain.processTickers(2500); 
        expect(brain.getNodesMap().get('timer_1').data.currentValue).toBe(1);

        // 3. User performs Manual Reset at T=2500 (sets currentValue = initialValue)
        // This triggers syncTickerRegistry which sees currentValue === initialValue
        vi.setSystemTime(2500); // Sync performance.now() mock
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id: 'timer_1', data: { currentValue: 0 } }
        });

        // The Reset Guard should have updated lastTick to 2500.
        expect(brain.tickerStates.get('timer_1').lastTick).toBe(2500);

        // 4. Advance to T=3499 (999ms after reset anchor 2500) -> Should NOT tick.
        // If Reset Guard failed, it would use 2000 as anchor and tick at T=3000.
        brain.processTickers(3499);
        expect(brain.getNodesMap().get('timer_1').data.currentValue).toBe(0);
        
        // 5. Advance to T=3501 (1001ms after reset anchor 2500) -> Tick!
        brain.processTickers(3501); 
        expect(brain.getNodesMap().get('timer_1').data.currentValue).toBe(1);
    });

    it('should support 1ms high-frequency overclocking (16.6 tick/frame)', async () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'timer_overclock',
                type: 'IN-11',
                data: { running: true, interval: 1, currentValue: 0 }
            }
        });

        // Anchor is 1000ms.
        // Advance exactly 16.67ms (one standard frame)
        brain.processTickers(1016.67);
        // Math.floor(16.67 / 1) = 16 ticks.
        expect(brain.getNodesMap().get('timer_overclock').data.currentValue).toBe(16);
        // Last tick consumed is now 1000 + 16 = 1016ms.
        expect(brain.tickerStates.get('timer_overclock').lastTick).toBe(1016);
    });

    it('should sanitize interval to a minimum of 1ms', async () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'timer_bad',
                type: 'IN-11',
                data: { running: true, interval: 0, currentValue: 0 }
            }
        });

        const anchor = brain.tickerStates.get('timer_bad').lastTick;
        // Interval 0 should be treated as 1ms.
        // Advance 0.5ms -> no tick.
        brain.processTickers(anchor + 0.5);
        expect(brain.getNodesMap().get('timer_bad').data.currentValue).toBe(0);
        
        // Advance 1.1ms -> 1 tick.
        brain.processTickers(anchor + 1.1);
        expect(brain.getNodesMap().get('timer_bad').data.currentValue).toBe(1);
    });

    it('should stop ticking and clean up registry when paused via data update', async () => {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'timer_1',
                type: 'IN-11',
                data: { running: true, interval: 1000 }
            }
        });

        expect(brain.activeTickers.has('timer_1')).toBe(true);

        // Pause
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id: 'timer_1', data: { running: false } }
        });

        expect(brain.activeTickers.has('timer_1')).toBe(false);
        expect(brain.tickerStates.has('timer_1')).toBe(false);
    });
});
