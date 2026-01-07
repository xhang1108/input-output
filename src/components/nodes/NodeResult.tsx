
'use client';

import { Handle, Position, useReactFlow, Node, Edge } from '@xyflow/react';
import { useState, useEffect, useRef } from 'react';
import { Play, AlertTriangle } from 'lucide-react';
import * as math from 'mathjs';
import { Brain } from '@/engine/Brain';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';

interface NodeResultProps {
    id: string;
    data: {
        label?: string;
    };
    selected?: boolean;
}

export function NodeResult({ id, data, selected }: NodeResultProps) {
    const { getNodes, getEdges } = useReactFlow();

    // State
    const [result, setResult] = useState<string>('0');
    const [formulaDisplay, setFormulaDisplay] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'value' | 'formula'>('value');

    // Ref to prevent loop-kill
    // We want to re-run calculation when the graph changes.
    // In a real app, we'd use a custom hook to listen to "store changes" more granularly.
    // For now, we will rely on a simple interval or a "pulse" from a global store if we had one.
    // BUT, the "Hybrid Pull" model says: Result Node triggers calculation.
    // React Flow doesn't automatically re-render components when *other* nodes move/change unless we subscribe.
    // Standard hack: Subscribe to edges/nodes changes via useStore but that's expensive.
    // Let's rely on a simpler trigger: We will re-calculate on every render for now (fast enough for small graphs),
    // OR we ideally need a "Pulse" context.

    // TODO: For Phase 1 MVP, we will simpler trigger: 
    // We'll set up a 100ms interval to check if we are "live".
    // Better: Rely on `useThinking` hook later.

    useEffect(() => {
        const calculate = () => {
            const nodes = getNodes();
            const edges = getEdges();
            const engine = new Brain(nodes, edges);

            try {
                // 1. Pull Data
                const payload = engine.getValue(id);

                // 2. Evaluate
                // If the formula is just '0' (fallback) don't run mathjs
                if (payload.formula === '0' && Object.keys(payload.scope).length === 0) {
                    setResult('0');
                    setFormulaDisplay('0');
                    setError(null);
                    return;
                }

                // 3. Execute Math
                // We use the ID-based formula + Scope
                const rawVal = math.evaluate(payload.formula, payload.scope);

                // 4. Update UI
                // Handle BigNodes/Matrices/Complex types safely
                // math.format returns a string representation, which handles objects gracefully
                const displayVal = math.format(rawVal, { precision: 4, lowerExp: -9, upperExp: 9 });

                setResult(displayVal);
                setFormulaDisplay(payload.display);
                setError(null);

            } catch (err: any) {
                // Cycle Detection or Math Error
                console.error(err);
                if (err.message.includes('Cycle')) {
                    setError('Loop-Error');
                } else {
                    setError('Math-Error');
                }
            }
        };

        // Run immediately
        calculate();

        // Re-run on graph interaction? 
        // Since we don't have a global signal yet, we'll poll fast.
        // This is temporary until we hook into `useNodesChange` properly.
        const interval = setInterval(calculate, 100);
        return () => clearInterval(interval);

    }, [getNodes, getEdges, id]);

    return (
        <NodeShell
            selected={selected}
            className={`min-w-[160px] rounded-xl border-2 shadow-xl transition-all ${error ? 'bg-red-950/50 border-red-500' : 'bg-zinc-900 border-green-500'
                }`}
        >
            {/* Input Handle */}
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputA"
                className={error ? "!bg-red-500" : "!bg-green-500"}
            />

            {/* Header */}
            <div className={`px-4 py-2 border-b flex items-center justify-between rounded-t-lg ${error ? 'bg-red-900/20 border-red-500/30' : 'bg-green-500/10 border-green-500/20'
                }`}>
                <div className={`text-xs font-bold uppercase tracking-wider ${error ? 'text-red-400' : 'text-green-400'
                    }`}>
                    {error ? 'ERROR' : 'RESULT'}
                </div>
                {error && <AlertTriangle className="w-4 h-4 text-red-500" />}
            </div>

            {/* Display Body */}
            <div
                className="p-4"
                onClick={() => setMode(m => m === 'value' ? 'formula' : 'value')}
            >
                {mode === 'value' ? (
                    <div className={`text-3xl font-mono font-bold truncate ${error ? 'text-red-500' : 'text-zinc-100'
                        }`}>
                        {error || result}
                    </div>
                ) : (
                    <div className="text-sm font-mono text-zinc-400 break-words">
                        {formulaDisplay || "?"}
                    </div>
                )}

                <div className="mt-2 text-[10px] text-zinc-600 font-medium uppercase tracking-widest text-right">
                    {mode === 'value' ? 'Click for Formula' : 'Click for Value'}
                </div>
            </div>
        </NodeShell>
    );
}

// Register in nodeTypes later
NodeResult.displayName = 'NodeResult';
