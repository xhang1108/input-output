import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';

// Global trackers
const renderCounts: Record<string, number> = {};
const logicTimes: Record<string, number> = {};

// Helper to track re-renders
export const useRenderTracker = (componentName: string) => {
    useRef(null); // Just to ensure hook rules
    if (!renderCounts[componentName]) renderCounts[componentName] = 0;
    renderCounts[componentName]++;
};

// Helper to track logic execution time
export const trackLogic = (name: string, durationMs: number) => {
    if (!logicTimes[name]) logicTimes[name] = 0;
    // Accumulate total time per second
    logicTimes[name] += durationMs;
};

export const Profiler = () => {
    const [stats, setStats] = useState({ fps: 0, memory: 0, renders: {} as Record<string, number>, logic: {} as Record<string, number> });

    useEffect(() => {
        let lastTime = performance.now();
        let frames = 0;
        let animationId: number;

        const loop = () => {
            const now = performance.now();
            frames++;

            if (now - lastTime >= 1000) {
                // Determine memory usage (Chrome only)
                const memory = (performance as any).memory
                    ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
                    : 0;

                setStats({
                    fps: frames,
                    memory,
                    renders: { ...renderCounts },
                    logic: { ...logicTimes }
                });

                // Reset counters
                for (const key in renderCounts) renderCounts[key] = 0;
                for (const key in logicTimes) logicTimes[key] = 0;

                frames = 0;
                lastTime = now;
            }
            animationId = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(animationId);
    }, []);

    if (process.env.NODE_ENV === 'production' && !useAppStore.getState().settings.showDebugInfo) return null;

    // Subscribe to store updates for visibility
    const { settings } = useAppStore();
    if (!settings.showDebugInfo) return null;

    return (
        <div className="fixed bottom-2 left-2 bg-black/80 text-green-400 p-2 rounded text-[10px] font-mono border border-green-900 z-9999 pointer-events-none shadow-xl backdrop-blur max-h-[300px] overflow-auto">
            <div className="flex gap-4 border-b border-green-900 pb-1 mb-1 font-bold">
                <span>FPS: {stats.fps}</span>
                <span>MEM: {stats.memory} MB</span>
            </div>

            {/* Logic Timings */}
            <div className="mb-2 border-b border-green-900/50 pb-1">
                <div className="text-zinc-500 font-bold mb-1">LOGIC (ms/sec)</div>
                <div className="grid grid-cols-2 gap-x-4">
                    {Object.entries(stats.logic)
                        .sort(([, a], [, b]) => b - a)
                        .filter(([, time]) => time > 0)
                        .map(([name, time]) => (
                            <div key={name} className="flex justify-between">
                                <span className="text-zinc-400">{name}</span>
                                <span className={time > 16 ? "text-red-400 font-bold" : "text-zinc-300"}>
                                    {time.toFixed(1)}ms
                                </span>
                            </div>
                        ))}
                    {Object.keys(stats.logic).length === 0 && <span className="text-zinc-600 italic">No heavy logic</span>}
                </div>
            </div>

            {/* Render Counts */}
            <div>
                <div className="text-zinc-500 font-bold mb-1">RENDERS (/sec)</div>
                <div className="grid grid-cols-2 gap-x-4">
                    {Object.entries(stats.renders)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 10)
                        .map(([name, count]) => (
                            <div key={name} className="flex justify-between">
                                <span className="text-zinc-500">{name}</span>
                                <span className={count > 60 ? "text-orange-400 font-bold" : "text-zinc-300"}>
                                    {count}
                                </span>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};
