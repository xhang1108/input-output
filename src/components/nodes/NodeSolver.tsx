'use client';

import { Handle, Position, useReactFlow } from '@xyflow/react';
import { useState, useEffect } from 'react';
import { Sigma } from 'lucide-react';
import nerdamer from 'nerdamer';
import 'nerdamer/Solve'; // Extend nerdamer with solve function
import { NodeShell } from './NodeShell';
import { TargetHandle } from '../handles/TargetHandle';
import { SourceHandle } from '../handles/SourceHandle';

interface NodeSolverProps {
    id: string;
    data: {
        label?: string;
        value?: number; // The solved value
        targetVar?: string; // The variable to solve for (e.g. 'x')
        inheritedAST?: any; // The LHS expression (e.g. 2x + 5)
        rhsValue?: number; // The RHS value (e.g. 15)
    };
}

export function NodeSolver({ id, data, selected }: NodeSolverProps & { selected?: boolean }) {
    const { updateNodeData } = useReactFlow();
    const [targetVar, setTargetVar] = useState(data.targetVar || 'x');
    const [solution, setSolution] = useState<string>('?');

    // Handle solving
    useEffect(() => {
        if (!data.inheritedAST) {
            setSolution('Waiting for input...');
            return;
        }

        try {
            // 1. Get LHS expression string
            const lhs = data.inheritedAST.toString();

            // 2. Get RHS (default to 0 if not connected)
            // Note: In a real implementation, we'd need a second input handle for RHS, 
            // but for MVP let's assume LHS = 0 or LHS = Constant.
            // Or better: LHS - RHS = 0.
            // For now, let's assume the input IS the equation expression (e.g. "2x - 10").

            // 3. Solve
            // nerdamer.solve(equation, variable)
            const result = (nerdamer as any).solve(lhs, targetVar);

            // Result is an array of solutions (e.g. [5])
            const sol = result.toString();
            setSolution(sol);

            // Update node data with the first numeric solution if possible
            // nerdamer returns parsing string like "[5]". We need to extract.
            const cleanSol = sol.replace(/[\[\]]/g, '');
            const num = Number(cleanSol);

            if (!isNaN(num)) {
                updateNodeData(id, { value: num });
            }

        } catch (e) {
            console.error(e);
            setSolution('Error');
        }
    }, [data.inheritedAST, targetVar, updateNodeData, id]);

    return (
        <NodeShell
            selected={selected}
            className="bg-zinc-900 border-2 border-indigo-500 rounded-xl p-4 shadow-lg min-w-[200px]"
        >
            {/* Inputs */}
            <TargetHandle
                nodeId={id}
                position={Position.Left}
                id="eq"
            />

            <div className="flex items-center gap-2 mb-3 border-b border-zinc-800 pb-2">
                <Sigma className="w-5 h-5 text-indigo-500" />
                <span className="text-zinc-200 font-bold text-sm">Solver</span>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500">Solve for:</label>
                    <input
                        type="text"
                        value={targetVar}
                        onChange={(e) => {
                            setTargetVar(e.target.value);
                            updateNodeData(id, { targetVar: e.target.value });
                        }}
                        className="w-10 bg-zinc-800 border border-zinc-700 rounded px-1 text-xs text-center text-white focus:outline-none focus:border-indigo-500"
                    />
                </div>

                <div className="bg-zinc-950 rounded p-2 text-center">
                    <div className="text-[10px] text-zinc-500 mb-1">SOLUTION</div>
                    <div className="text-xl font-mono text-indigo-400 font-bold">
                        {solution}
                    </div>
                </div>
            </div>

            {/* Output (The solved value) */}
            <SourceHandle
                position={Position.Right}
                color="indigo"
            />
        </NodeShell>
    );
}
