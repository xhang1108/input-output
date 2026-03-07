import { RefObject, useEffect, useRef } from 'react';
import { Brain } from '../../../engine/Brain';

interface UseContentMetricsOptions {
    /** Node ID to update in Brain */
    id: string;
    /**
     * Debounce delay in ms before flushing to Brain.
     * Keeps ResizeObserver callbacks from hammering the engine during text reflow.
     * @default 100
     */
    debounceMs?: number;
}

/**
 * 📐 useContentMetrics
 *
 * ResizeObserver bridge — automatically captures height/width changes caused by
 * text reflow or content expansion, without requiring the user to drag a resize handle.
 *
 * Writes into `Brain.updateNodeBoundingBox()` (no Undo history pollution).
 * Pure DOM → Engine signal channel.
 *
 * @see MASTER_TODO_2.md §2.5 Content Metrics Protocol
 */
export function useContentMetrics(
    ref: RefObject<HTMLElement | null>,
    { id, debounceMs = 100 }: UseContentMetricsOptions
) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastBoxRef = useRef<{ width: number; height: number } | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const brain = Brain.getInstance();

        const flush = (width: number, height: number) => {
            const last = lastBoxRef.current;
            // Skip if dimension hasn't changed to avoid spurious updates
            if (last && Math.abs(last.width - width) < 1 && Math.abs(last.height - height) < 1) return;
            lastBoxRef.current = { width, height };
            brain.updateNodeBoundingBox(id, { width, height });
        };

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;

                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => {
                    flush(width, height);
                }, debounceMs);
            }
        });

        observer.observe(el);

        // Initial read so Brain has at least one measurement on mount
        const rect = el.getBoundingClientRect();
        flush(rect.width, rect.height);

        return () => {
            observer.disconnect();
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [id, debounceMs, ref]);
}
