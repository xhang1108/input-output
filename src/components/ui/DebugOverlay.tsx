'use client';

import { useStore as useRFStore } from '@xyflow/react';
import { useAppStore } from '../../store/useStore';

export function DebugOverlay({ mode }: { mode: string }) {
    const actionLog = useAppStore(s => s.actionLog);
    const logAction = useAppStore(s => s.logAction);

    // Access React Flow internal store for stats
    const nodeCount = useRFStore(s => s.nodeLookup.size);
    const edgeCount = useRFStore(s => s.edges.length);
    const transform = useRFStore(s => s.transform);
    const selectedNodes = useRFStore(s => s.nodes.filter(n => n.selected).length);

    return (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md border border-zinc-800 text-zinc-400 p-3 rounded-lg text-xs font-mono z-50 shadow-xl pointer-events-none select-none max-h-[80vh] flex flex-col">
            <h3 className="text-zinc-500 font-bold mb-2 uppercase tracking-wider">Debug Stats</h3>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <span>Mode:</span>
                <span className={mode !== 'IDLE' ? 'text-amber-400 font-bold' : 'text-zinc-300'}>
                    {mode}
                </span>

                <span>Nodes:</span>
                <span className="text-zinc-300">{nodeCount}</span>

                <span>Edges:</span>
                <span className="text-zinc-300">{edgeCount}</span>

                <span>Selected:</span>
                <span className="text-zinc-300">{selectedNodes}</span>

                <span>Zoom:</span>
                <span className="text-zinc-300">{transform[2].toFixed(2)}x</span>

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
