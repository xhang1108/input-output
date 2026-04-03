'use client';

import { useState, useEffect } from 'react';

import { useStore as useRFStore } from '@xyflow/react';
import { useAppStore } from '../../store/useStore';

export function DebugOverlay({ mode }: { mode: string }) {
    const actionLog = useAppStore(s => s.actionLog);
    const logAction = useAppStore(s => s.logAction);

    // Dynamic FPS Counter
    const [fps, setFps] = useState(0);
    useEffect(() => {
        let frameCount = 0;
        let lastTime = performance.now();
        let animationFrameId: number;

        const tick = () => {
            frameCount++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
                setFps(Math.round((frameCount * 1000) / (now - lastTime)));
                frameCount = 0;
                lastTime = now;
            }
            animationFrameId = requestAnimationFrame(tick);
        };

        animationFrameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    // Access React Flow internal store for stats
    const nodeCount = useRFStore(s => s.nodeLookup.size);
    const edgeCount = useRFStore(s => s.edges.length);
    const transform = useRFStore(s => s.transform);
    const selectedNodes = useRFStore(s => s.nodes.filter(n => n.selected).length);

    return (
        <div className="absolute top-4 left-4 bg-(--node-bg)/80 backdrop-blur-md border border-zinc-800 text-zinc-400 p-3 rounded-lg text-xs font-mono z-50 pointer-events-none select-none max-h-[80vh] flex flex-col">
            <h3 className="text-zinc-500 font-bold mb-2 uppercase tracking-wider">Debug Stats</h3>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <span>Mode:</span>
                <span className={mode !== 'IDLE' ? 'text-(--color-scalar) font-bold' : 'text-zinc-300'}>
                    {mode}
                </span>

                <span>FPS:</span>
                <span className={`font-bold ${fps >= 55 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {fps}
                </span>

                <span>Nodes:</span>
                <span className="text-zinc-300">{nodeCount}</span>

                <span>Edges:</span>
                <span className="text-zinc-300">{edgeCount}</span>

                <span>Selected:</span>
                <span className="text-zinc-300">{selectedNodes}</span>

                <span>Zoom:</span>
                <span className="text-zinc-300">{transform[2].toFixed(2)}x</span>

                <span>Status:</span>
                <span className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full`} style={{
                        backgroundColor: (window as any).brain?.getStatus().isRecalculating ? '#ef4444' : '#22c55e',
                        boxShadow: (window as any).brain?.getStatus().isRecalculating ? '0 0 8px #ef4444' : 'none',
                        animation: (window as any).brain?.getStatus().isRecalculating ? 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                    }} />
                    <span style={{ color: (window as any).brain?.getStatus().isRecalculating ? '#ef4444' : '#22c55e', fontWeight: 'bold' }}>
                        {(window as any).brain?.getStatus().isRecalculating ? 'COMPUTING' : 'IDLE'}
                    </span>
                </span>

                <span>Solve Time:</span>
                <span className="text-zinc-300">{(window as any).brain?.getStatus().solveMs.toFixed(2)} ms</span>

                <span>Pan:</span>
                <span className="text-zinc-300">{Math.round(transform[0])}, {Math.round(transform[1])}</span>
            </div>

            {/* Action Log */}
            <div className="mt-3 pt-2 border-t border-zinc-800 pointer-events-auto">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-zinc-500 font-bold uppercase tracking-wider">Recent Actions</span>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(actionLog.join('\n'));
                            // Simple visual feedback could be added, but for debug this is fine.
                            console.log('Copied logs');
                        }}
                        className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                        title="Copy Log"
                    >
                        COPY
                    </button>
                </div>
                <ul className="flex flex-col gap-0.5 pointer-events-none">
                    {actionLog.slice(0, 15).map((log, i) => (
                        <li key={i} className="text-[10px] text-zinc-400 truncate opacity-80">
                            {log}
                        </li>
                    ))}
                    {actionLog.length === 0 && <span className="text-[10px] text-zinc-600 italic">No actions yet</span>}
                </ul>
            </div>
        </div>
    );
}

