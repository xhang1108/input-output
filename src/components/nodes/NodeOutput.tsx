'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useExpressionFormatter } from '@/hooks/useExpressionFormatter';

interface NodeOutputData {
    value?: number;
    result?: number;
    error?: string;
    inheritedAST?: unknown;
    label?: string;
    [key: string]: unknown;
}

export function NodeOutput({ id, data }: NodeProps) {
    const outputData = data as NodeOutputData;
    const [isSymbolic, setIsSymbolic] = useState(false);

    const { formatExpression } = useExpressionFormatter();

    let displayValue = '—';

    if (outputData.result !== undefined && outputData.result !== null) {
        // Prefer calculated result
        const val = outputData.result as any;
        if (typeof val === 'number' && !isNaN(val)) {
            displayValue = val.toFixed(2).replace(/\.?0+$/, '');
        } else {
            displayValue = String(val);
        }
    } else if (outputData.value !== undefined && outputData.value !== null) {
        const val = outputData.value as any;
        if (Array.isArray(val) || (val.isMatrix)) { // Simple check
            const arr = val.toArray ? val.toArray() : val;
            displayValue = JSON.stringify(arr, (k, v) =>
                typeof v === 'number' ? Number(v.toFixed(2)) : v
            ).replace(/,/g, ', ');
        } else if (typeof val === 'number' && !isNaN(val)) {
            displayValue = val.toFixed(2).replace(/\.?0+$/, '');
        } else {
            displayValue = String(val);
        }
    }

    // Use the hook to get the formatted expression
    const formula = formatExpression(id, isSymbolic);

    return (
        <div className="bg-zinc-200 border-2 border-green-500 rounded-xl p-4 shadow-[0_0_15px_rgba(34,197,94,0.3)] min-w-[200px] group transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] hover:border-green-400 relative">
            <Handle
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !bg-green-500 !border-2 !border-zinc-200"
            />

            <div className="flex flex-col items-center gap-3">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between w-full">
                    <span>Result</span>
                    <div className="flex items-center space-x-2">
                        <Label htmlFor={`mode-${id}`} className="text-[10px] cursor-pointer">{isSymbolic ? 'SYM' : 'NUM'}</Label>
                        <Switch
                            id={`mode-${id}`}
                            checked={isSymbolic}
                            onCheckedChange={setIsSymbolic}
                            className="h-4 w-7" // Smaller switch
                        />
                    </div>
                </div>

                {/* Formula Preview */}
                <div className="text-xs text-zinc-600 font-mono w-full px-2 py-2 bg-zinc-100 rounded border border-zinc-300 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-zinc-300 max-w-[250px]" title={formula || 'No input'}>
                    {formula || <span className="text-zinc-400 italic">No Expression</span>}
                </div>

                <div className="text-3xl font-mono font-bold text-zinc-800 tabular-nums my-1">
                    {displayValue}
                </div>
            </div>
        </div>
    );
}
