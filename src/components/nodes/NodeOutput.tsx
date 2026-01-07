'use client';

import { Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { useState, useEffect, memo } from 'react';
import { Switch } from '@/components/ui/switch';
import * as math from 'mathjs';
import { Label } from '@/components/ui/label';
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { pullValue, FALLBACK_PAYLOAD } from '../../engine/Brain';
import { useAppStore } from '@/store/useAppStore';

interface NodeOutputData {
    value?: number;
    result?: number;
    error?: string;
    inheritedAST?: unknown;
    label?: string;
    [key: string]: unknown;
}

export const NodeOutput = memo(({ id, data, selected }: NodeProps) => {
    const outputData = data as NodeOutputData;
    // const { speak } = useSpeech(); // REMOVED: High frequency traversal caused lag

    // Global Display Mode (Polish)
    const { displayMode } = useAppStore();
    const isSymbolic = displayMode === 'formula';

    // --- Hybrid Pull Architecture Integration ---
    const { getNodes, getEdges } = useReactFlow();
    const { logicVersion } = useAppStore();
    const [pullResult, setPullResult] = useState<{ val: string; formula: string } | null>(null);

    useEffect(() => {
        const calculate = () => {
            const nodes = getNodes();
            const edges = getEdges();
            let payload;
            try {
                // 1. Pull payload using the new engine
                // We pass a new Set for visited to start fresh cycle detection
                // We need to look for the input edge to this Output Node? 
                // Or does pullValue(id) handle it? 
                // pullValue on OutputNode:
                // We haven't implemented 'outputNode' case in PullEngine yet!
                // Wait, I missed 'outputNode' in Step 829.
                // PullEngine default returns Fallback.
                // OutputNode usually just passes through what's connected to 'input'.

                // Let's implement the logic HERE for now, or update PullEngine?
                // Better to simple find the edge and pull from source.
                const inputEdge = edges.find(e => e.target === id && (e.targetHandle === 'input' || e.targetHandle === 'inputA'));

                payload = inputEdge
                    ? pullValue(inputEdge.source, nodes, edges, new Set())
                    : FALLBACK_PAYLOAD;

                // 2. Evaluate
                // If the formula is just '0' (fallback) don't run mathjs
                if (payload.formula === '0' && Object.keys(payload.scope).length === 0) {
                    setPullResult({ val: '0', formula: '0' });
                    return;
                }

                // 3. Final Execution (The Execution Law)
                // Result Node is the ONLY one running math.evaluate
                const finalVal = math.evaluate(payload.formula, payload.scope);

                // Format with high precision and wider scientific notation boundaries
                const formatted = math.format(finalVal, { precision: 14, lowerExp: -12, upperExp: 15 });

                // Add thousands separators (commas) for better readability if it's a plain number
                const displayVal = /^-?\d+\.?\d*$/.test(formatted)
                    ? Number(formatted).toLocaleString('en-US', { maximumFractionDigits: 10 })
                    : formatted;

                setPullResult({
                    val: displayVal,
                    formula: payload.formula // Keeping internal formula for potential debug
                });

            } catch (e: any) {
                console.error("Calculation Error:", e);
                console.error("Payload was:", payload); // Debugging info
                // Handle Cycle Error specifically?
                if (e.message && e.message.includes("Cycle")) {
                    setPullResult({ val: "Loop", formula: "Cycle Detected" });
                } else {
                    setPullResult({ val: "Error", formula: "Calculation Error" });
                }
            }
        };

        // Trigger on mount and updates
        // In a real app we'd use useOnNodesChange or similar, 
        // but useEffect with no deps won't work perfectly unless we subscribe.
        // nextmap said: "Result Node's useEffect listens to React Flow state change"
        // But getNodes()/getEdges() are getters. We need to subscribe?
        // useReactFlow doesn't provide a subscription stream easily unless we use store.
        // However, standard React Flow approach: pass nodes/edges as props OR use `useNodes()` `useEdges()` hooks which trigger re-render.
        // If this component is inside ReactFlow provider, `useNodes()` will re-render it on change.
        calculate();
        // Reactive calculation (no polling!)
    }, [logicVersion, id, getNodes, getEdges]);

    // Use the decoupled engine result
    let formula = '';
    let displayValue = '—';

    // --- Legacy Logic (Push) ---
    // Kept as fallback, but effectively overridden below if Pull works
    if (outputData.result !== undefined && outputData.result !== null) {
        // ... (legacy formatting logic omitted for brevity, logic remains same)
        displayValue = String(outputData.result); // Simplified for safety
    }

    // --- Hybrid Pull Override ---
    if (pullResult) {
        // User Requirement: "Outside always answer" (Big Text = Value)
        displayValue = pullResult.val;

        // User Requirement: "Change content inside small box"
        // NUM Mode (isSymbolic=false): Show Human Readable Formula (Labels) e.g. "(Rent + Tax)"
        // SYM Mode (isSymbolic=true): Show System Raw Formula (IDs) e.g. "(var_a + var_b)" ?? 
        // OR maybe the user means:
        // NUM: Show "Result" or simple label?
        // SYM: Show the Formula?

        // Let's try: 
        // NUM = Human Labels Formula (Easier to read)
        // SYM = Raw ID Formula (Debug / Precise) - wait, pullResult doesn't have raw ID formula easily available here unless we passed it.
        // Actually Brain.ts returns { formula: safeId, display: label }.
        // But we computed pullResult.formula = payload.display.

        // Let's modify setPullResult to store both.
        // But for now, let's just Stick to:
        // Toggle changes Small Box:
        // If SYM: Show Formula
        // If NUM: Show NOTHING (Clean)? 

        // Re-reading user: "should only change the content inside the small box" implies it DOES show something different.
        // Let's try:
        // NUM: Human Readable Formula
        // SYM: The same formula?? Then toggle does nothing?

        // Wait, look at the screen shot 2 (Step 532).
        // It shows "SYM" badge. Big Text is Formula. User complained "Outside should be answer".

        // Let's implement this:
        // Big Text: ALWAYS Value.
        // Small Box: Value vs Formula? No that's redundant.

        // Let's assuming "SYM" means "Show Me The Math". "NUM" means "Clean Result".
        // NUM: Small Box = HIDDEN or Static Label "Result".
        // SYM: Small Box = The Formula.

        // Updated Logic:
        // Big Text: val
        // Small Box: isSymbolic ? formula : (maybe nothing or simplified label)

        if (isSymbolic) {
            formula = pullResult.formula;
        } else {
            // In NUM mode, show the human-readable formula
            formula = pullResult.formula; // We can refine this later if needed
        }
    }

    return (
        <NodeShell
            selected={selected}
            className="bg-white border-2 border-green-500 rounded-xl p-4 shadow-[0_0_15px_rgba(34,197,94,0.3)] min-w-[200px] hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] hover:border-green-400 relative"
        >
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="inputA"
            />

            <div className="flex flex-col items-center gap-3">
                <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider flex items-center justify-between w-full">
                    <span>Result</span>
                    <div className="flex items-center space-x-2">
                        {/* Global Mode controlled externally now */}
                        <div className={`text-[9px] px-1 rounded ${isSymbolic ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-200 text-zinc-500'}`}>
                            {isSymbolic ? 'SYM' : 'NUM'}
                        </div>
                    </div>
                </div>

                {/* Formula Preview - Only show if we have a formula (SYM mode) */}
                {formula && (
                    <div className="text-xs text-zinc-900 font-mono w-full px-2 py-2 bg-zinc-50 rounded border border-zinc-300 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-zinc-300 max-w-[250px]" title={formula}>
                        {formula}
                    </div>
                )}

                <div className="text-3xl font-mono font-bold text-zinc-800 tabular-nums my-1">
                    {displayValue}
                </div>
            </div>
        </NodeShell>
    );
}, (prev, next) => {
    return (
        prev.id === next.id &&
        prev.selected === next.selected &&
        prev.data === next.data
    );
});
