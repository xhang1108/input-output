import { memo, useState, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { Brain } from '../../engine/Brain';
import { Copy, Check } from 'lucide-react';
import { DataType } from '../../types/payload';

export const ResultNode = memo((props: NodeProps) => {
    const { id, data } = props;

    // Custom single input handle
    const handles = useMemo(() => [
        {
            id: 'in',
            type: 'target' as const,
            position: Position.Left,
            variant: 'single' as const
        }
    ], []);

    const nodeData = { ...data, handles };
    const value = data.value;
    const precision = typeof data.precision === 'number' ? data.precision : -1;
    const unitStr = data.unit as string | undefined;

    const [copied, setCopied] = useState(false);

    let displayValue: React.ReactNode = '...';
    let displayString = ''; // For copying
    let dataTypeColor = 'text-zinc-400';
    let isError = false;
    let isMatrix = false;
    let matrixData: unknown[][] = [];

    const formatUnit = (unit: string | undefined): string => {
        if (!unit) return '';
        // 🚀 Aggressive fix for multi-units: "m m" or "m * m" -> "m^2"
        const clean = unit.replace(/\s+\*\s+/g, ' '); // normalize "m * m" to "m m"
        const parts = clean.split(/\s+/);
        if (parts.length > 1 && parts.every(p => p === parts[0])) {
            return `${parts[0]}^${parts.length}`;
        }
        return unit;
    };

    const formatRawValue = (val: any): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'number') {
            if (precision >= 0) {
                const p = Math.max(0, Math.min(20, precision));
                return val.toLocaleString(undefined, {
                    minimumFractionDigits: p,
                    maximumFractionDigits: p
                });
            }
            const absVal = Math.abs(val);
            if (absVal !== 0 && (absVal < 0.0001 || absVal > 100000000)) {
                return val.toExponential(4);
            }
            return val.toLocaleString(undefined, { maximumFractionDigits: 10 });
        }
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';

        // 🧪 Handle Strings (including those dehydrated from BigNumber/Node)
        if (typeof val === 'string') {
            // If it looks like a very long number from BigNumber (e.g. 50+ chars), truncate it for display
            if (/^-?\d+\.\d+$/.test(val) && val.length > 30) {
                return val.substring(0, 20) + '...';
            }
            return val;
        }

        if (typeof val === 'object') {
            // Handle MathJS specific dehydrated types
            if (val.mathjs === 'Complex' && val.re !== undefined && val.im !== undefined) {
                return `${formatRawValue(val.re)}${val.im >= 0 ? '+' : ''}${formatRawValue(val.im)}i`;
            }
            if (val.mathjs === 'BigNumber') return formatRawValue(val.value);
            if (val.mathjs === 'Fraction') return `${val.n}/${val.d}`;
            if (val.mathjs === 'Unit') return `${val.value} ${formatUnit(val.unit)}`.trim();
            if (val.mathjs === 'Matrix') {
                if (Array.isArray(val.data)) {
                    return `[${val.data.map((item: any) => formatRawValue(item)).join(', ')}]`;
                }
                return 'Matrix';
            }

            // 🛡️ Note: Stringified nodes are handled by the 'string' case above.
            if (val.mathjs && val.mathjs.endsWith('Node')) return '[Symbolic]';

            // Handle Arrays (Vector-like)
            if (Array.isArray(val)) {
                return `[${val.map(item => formatRawValue(item)).join(', ')}]`;
            }

            // Handle Plain Objects (Recursive)
            const keys = Object.keys(val).filter(k => k !== 'constructor' && !k.startsWith('_'));
            if (keys.length > 0) {
                const entries = keys.map(k => `${k}: ${formatRawValue(val[k])}`);
                return `{ ${entries.join(', ')} }`;
            }
            return '{}';
        }

        return String(val);
    };

    const payload = (typeof value === 'object' && value !== null && 'type' in value)
        ? value as import('../../types/payload').NodePayload
        : (value !== undefined ? PayloadUtils.wrap(value) : null);

    if (payload) {
        if (payload.type === DataType.Error) {
            const errStr = String(payload.meta?.error || 'Error');
            displayValue = errStr;
            displayString = errStr;
            isError = true;
        } else {
            const rawValue = PayloadUtils.unwrap(payload);
            const type = payload.type;

            // Set Color based on type
            switch (type) {
                case DataType.Scalar: dataTypeColor = 'text-(--color-scalar)'; break;
                case DataType.String: dataTypeColor = 'text-(--color-string)'; break;
                case DataType.Matrix: dataTypeColor = 'text-(--color-matrix)'; isMatrix = true; break;
                case DataType.Boolean: dataTypeColor = 'text-(--color-boolean)'; break;
            }

            if (isMatrix) {
                if (Array.isArray(rawValue)) {
                    matrixData = rawValue;
                } else if (typeof rawValue === 'object' && rawValue !== null) {
                    const r = rawValue as any;
                    if (r.mathjs === 'Matrix') matrixData = r.data || [];
                    else if (r.toArray) matrixData = r.toArray();
                }
                displayString = JSON.stringify(matrixData);
            } else {
                displayString = formatRawValue(rawValue);
                displayValue = displayString;

                // Handle units and bases
                const finalUnit = unitStr || payload.meta?.unit;
                const isBaseUnit = finalUnit && ['BIN', 'OCT', 'HEX', 'DUO', 'DEC'].includes(finalUnit);
                const numValue = typeof rawValue === 'number' ? rawValue : (typeof rawValue === 'string' && !isNaN(Number(rawValue)) ? Number(rawValue) : null);

                if (isBaseUnit && numValue !== null) {
                    let formatted = '';
                    let prefix = '';
                    switch (finalUnit) {
                        case 'BIN': formatted = Math.abs(numValue).toString(2); prefix = '0b'; break;
                        case 'OCT': formatted = Math.abs(numValue).toString(8); prefix = '0o'; break;
                        case 'HEX': formatted = Math.abs(numValue).toString(16).toUpperCase(); prefix = '0x'; break;
                        case 'DUO': formatted = toBase12(Math.abs(numValue)); prefix = '0z'; break;
                        default: formatted = Math.abs(numValue).toString(10);
                    }
                    if (numValue < 0) prefix = '-' + prefix;
                    const combined = `${prefix}${formatted}`;
                    displayString = `${combined} ${finalUnit}`;
                    displayValue = (
                        <div className="flex flex-col items-end">
                            <div className="flex items-baseline gap-1.5 leading-none">
                                <span className={`font-mono transition-all duration-200 text-2xl text-(--color-scalar)`}>{combined}</span>
                                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-1 rounded">{finalUnit}</span>
                            </div>
                        </div>
                    );
                } else if (finalUnit) {
                    const unitSuffix = finalUnit.replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/ /g, '');
                    const valStr = displayString;
                    displayString = `${valStr} ${finalUnit}`;
                    displayValue = (
                        <div className="flex flex-col items-end">
                            <div className="flex items-baseline gap-1.5 leading-none">
                                <span className={`font-mono transition-all duration-200 text-2xl ${dataTypeColor}`}>{valStr}</span>
                                <span className="text-xs font-bold text-zinc-500 italic">{unitSuffix}</span>
                            </div>
                        </div>
                    );
                }
            }
        }
    }

    const copyToClipboard = () => {
        if (displayString && displayString !== '[object Object]') {
            navigator.clipboard.writeText(displayString);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handlePrecisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { precision: parseInt(e.target.value) } }
        });
    };

    const renderMatrix = (grid: unknown[][]) => {
        if (!grid || !grid.length) return <span className="text-xs text-zinc-500">Empty Matrix</span>;
        return (
            <div className="flex flex-col gap-0.5 items-center">
                {grid.slice(0, 8).map((row, r) => (
                    <div key={r} className="flex gap-0.5">
                        {Array.isArray(row) && row.slice(0, 8).map((val, c) => (
                            <div key={c} className="w-8 h-6 flex items-center justify-center text-[9px] font-mono bg-zinc-800/30 border border-zinc-700/30 rounded text-zinc-400">
                                {formatRawValue(val)}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="p-3 flex flex-col gap-2 min-w-[140px]">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Result</label>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={copyToClipboard}
                            className={`nodrag p-1 rounded hover:bg-zinc-800 transition-colors ${copied ? 'text-green-500' : 'text-zinc-500'}`}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        {!isMatrix && (
                            <select
                                className="nodrag bg-transparent text-[9px] text-zinc-600 border-none outline-none cursor-pointer hover:text-zinc-400"
                                value={precision}
                                onChange={handlePrecisionChange}
                            >
                                <option value={-1}>Auto</option>
                                {[0, 1, 2, 3, 4, 5, 6, 8, 10].map(p => (
                                    <option key={p} value={p}>{p} d.p.</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className={`w-full min-h-[44px] flex items-center justify-end border border-zinc-800/50 rounded-lg px-3 py-2 bg-black/20 transition-colors ${isError ? 'border-red-900/30' : ''}`}>
                    {isMatrix ? renderMatrix(matrixData) : (
                        <div className={`font-mono truncate ${isError ? 'text-red-500 text-sm' : `text-2xl ${dataTypeColor}`}`}>
                            {displayValue}
                        </div>
                    )}
                </div>
            </div>
        </BaseNode>
    );
});

function toBase12(num: number): string {
    const integerPart = Math.floor(num);
    const fractionalPart = num - integerPart;
    let result = integerPart.toString(12).toUpperCase();
    if (fractionalPart > 0) {
        result += '.';
        let f = fractionalPart;
        for (let i = 0; i < 4; i++) {
            f *= 12;
            const digit = Math.floor(f);
            result += digit.toString(12).toUpperCase();
            f -= digit;
            if (f === 0) break;
        }
    }
    return result;
}

ResultNode.displayName = 'ResultNode';
