import { memo, useMemo, useState } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { DataType } from '../../types/payload';
import { Copy, Check } from 'lucide-react';

export const MatrixResultNode = memo((props: NodeProps) => {
    const { id, data } = props;

    // Custom single input handle + Legacy handles
    const handles = useMemo(() => [
        {
            id: 'in',
            type: 'target' as const,
            position: Position.Left,
            variant: 'single' as const,
            dataType: 'matrix' as const
        }
    ], []);

    const nodeData = { ...data, handles };
    const payload = data.value as import('../../types/payload').NodePayload;

    const [copied, setCopied] = useState(false);

    let matrixData: unknown[][] = [];
    let isValid = false;
    let rows = 0;
    let cols = 0;
    let errorMessage: string | null = null;
    let displayString = ''; // For copying

    const formatValue = (val: any): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'number') return String(Math.round(val * 1000) / 1000);
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (typeof val === 'string') return val;

        if (typeof val === 'object') {
            if (val.mathjs === 'Complex' && val.re !== undefined && val.im !== undefined) {
                return `${val.re}${val.im >= 0 ? '+' : ''}${val.im}i`;
            }
            if (val.mathjs === 'BigNumber') return val.value;
            if (val.mathjs === 'Fraction') return `${val.n}/${val.d}`;
            if (val.mathjs === 'Unit') {
                const u = (val.unit || '').replace(/\s+\*\s+/g, ' '); // normalize "m * m" to "m m"
                const parts = u.split(/\s+/);
                const formattedUnit = (parts.length > 1 && parts.every((p: string) => p === parts[0]))
                    ? `${parts[0]}^${parts.length}`
                    : u;
                return `${val.value} ${formattedUnit}`.trim();
            }
            if (val.mathjs === 'Matrix') return 'Matrix';

            if (Array.isArray(val)) {
                return `[${val.map(item => formatValue(item)).join(', ')}]`;
            }

            const keys = Object.keys(val).filter(k => k !== 'constructor' && !k.startsWith('_'));
            if (keys.length > 0) {
                const entries = keys.map(k => `${k}: ${formatValue(val[k])}`);
                return `{ ${entries.join(', ')} }`;
            }
            if (keys.length === 0 && Object.keys(val).length > 0) return '[Object]';
        }
        return String(val);
    };

    if (payload) {
        if (payload.type === DataType.Error) {
            errorMessage = payload.meta?.error || 'Error';
            displayString = errorMessage;
        } else {
            const rawValue = PayloadUtils.unwrap(payload);
            displayString = JSON.stringify(rawValue); // Best format for matrix copy

            // Try to extract matrix data
            let tempGrid: any = null;
            if (Array.isArray(rawValue)) {
                tempGrid = rawValue;
            } else if (typeof rawValue === 'object' && rawValue !== null) {
                const r = rawValue as any;
                if (r.isMatrix && r.toArray) tempGrid = r.toArray();
                else if (r.mathjs === 'Matrix') tempGrid = r.data || [];
            }

            if (tempGrid) {
                // Normalize 1D (Vector) to 2D (Matrix)
                if (tempGrid.length > 0 && !Array.isArray(tempGrid[0])) {
                    matrixData = [tempGrid]; // Horizontal vector
                } else {
                    matrixData = tempGrid;
                }
                isValid = true;
            } else if (typeof rawValue === 'number' || typeof rawValue === 'object') {
                // Treat scalar or single object as 1x1 matrix
                matrixData = [[rawValue]];
                isValid = true;
            } else {
                errorMessage = "Invalid Matrix Data";
                displayString = errorMessage;
            }
        }
    } else {
        errorMessage = "Waiting for Data...";
        displayString = '';
    }

    const copyToClipboard = () => {
        if (displayString) {
            navigator.clipboard.writeText(displayString);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (isValid) {
        rows = matrixData.length;
        cols = matrixData[0]?.length || 0;
    }

    if (isValid) {
        return (
            <BaseNode {...props} data={nodeData}>
                <div className="p-2 flex flex-col gap-1 items-center justify-center min-w-[120px]">
                    <div className="w-full flex justify-between items-center mb-1 px-1">
                        <label className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Matrix</label>
                        <button
                            onClick={copyToClipboard}
                            className={`nodrag p-1 rounded hover:bg-zinc-800 transition-colors ${copied ? 'text-green-500' : 'text-zinc-500'}`}
                        >
                            {copied ? <Check size={10} /> : <Copy size={10} />}
                        </button>
                    </div>
                    <div className="flex flex-col gap-1">
                        {matrixData.slice(0, 10).map((row, r) => (
                            <div key={r} className="flex gap-1">
                                {Array.isArray(row) ? row.slice(0, 10).map((val, c) => (
                                    <div
                                        key={c}
                                        className="w-12 h-8 flex items-center justify-center text-[10px] font-mono 
                                                 bg-zinc-800/50 border border-zinc-700/50 rounded 
                                                 text-zinc-200 overflow-hidden px-1"
                                        title={formatValue(val)}
                                    >
                                        <span className="truncate">{formatValue(val)}</span>
                                    </div>
                                )) : (
                                    <div className="w-12 h-8 flex items-center justify-center text-[10px] font-mono bg-zinc-800/50 border border-zinc-700/50 rounded text-zinc-200 overflow-hidden px-1">
                                        {formatValue(row)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {(rows > 10 || cols > 10) && (
                        <div className="text-[8px] text-zinc-600 italic">Showing 10x10</div>
                    )}
                    <div className="text-[10px] text-zinc-500 font-mono mt-1 border-t border-zinc-800/50 pt-1 w-full text-center">
                        {rows} × {cols}
                    </div>
                </div>
            </BaseNode>
        );
    }

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="p-4 flex flex-col items-center justify-center text-center min-h-[60px] min-w-[120px]">
                <span className="text-xs text-zinc-400 mb-1">{errorMessage}</span>
                {payload && (
                    <div className="text-[8px] text-zinc-600 font-mono break-all max-w-[150px] mt-2 border-t border-zinc-800 pt-1">
                        Type: {payload.type}<br />
                        Value: {(JSON.stringify(PayloadUtils.unwrap(payload)) || '').slice(0, 50)}
                    </div>
                )}
            </div>
        </BaseNode>
    );
});

MatrixResultNode.displayName = 'MatrixResultNode';
