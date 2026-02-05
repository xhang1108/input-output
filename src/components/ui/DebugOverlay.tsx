'use client';

import { useStore } from '@xyflow/react';

export function DebugOverlay({ mode }: { mode: string }) {
    // Access React Flow internal store for stats
    const nodeCount = useStore(s => s.nodeLookup.size);
    const edgeCount = useStore(s => s.edges.length);
    const transform = useStore(s => s.transform);
    const selectedNodes = useStore(s => s.nodes.filter(n => n.selected).length);

    return (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md border border-zinc-800 text-zinc-400 p-3 rounded-lg text-xs font-mono z-50 shadow-xl pointer-events-none select-none">
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
        </div>
    );
}
