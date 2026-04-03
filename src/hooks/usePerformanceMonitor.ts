import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useStore';

/**
 * usePerformanceMonitor
 * 
 * Tracks real-time rendering latency using requestAnimationFrame.
 * Highly Optimized: 
 * 1. 30-frame moving average for high stability.
 * 2. Update throttling: Only updates UI status every 1000ms (1 second).
 * 3. No bucketing: Returns raw averaged value for accuracy.
 */
export function usePerformanceMonitor() {
    const setUiRenderMs = useAppStore(s => s.setUiRenderMs);
    const lastFrameTimeRef = useRef<number>(performance.now());
    const frameTimesRef = useRef<number[]>([]);
    const lastValueRef = useRef<number | null>(null);
    const lastUpdateMsRef = useRef<number>(0);
    const requestRef = useRef<number>(undefined as unknown as number);

    useEffect(() => {
        const update = () => {
            const now = performance.now();
            const delta = now - lastFrameTimeRef.current;
            lastFrameTimeRef.current = now;

            // Moving average over 30 frames for stability
            frameTimesRef.current.push(delta);
            if (frameTimesRef.current.length > 30) {
                frameTimesRef.current.shift();
            }

            // Only update the actual Store every 1000ms (1 second) as requested
            if (now - lastUpdateMsRef.current > 1000) {
                const averageDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;

                // Absolute rounded value (no 5ms bucketing)
                const finalVal = Math.round(averageDelta);

                // Change detection guard
                if (finalVal !== lastValueRef.current) {
                    lastValueRef.current = finalVal;
                    setUiRenderMs(finalVal);
                    lastUpdateMsRef.current = now;
                }
            }

            requestRef.current = requestAnimationFrame(update);
        };

        requestRef.current = requestAnimationFrame(update);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [setUiRenderMs]);
}

