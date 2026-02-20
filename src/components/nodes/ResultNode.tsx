import { memo, useState, useMemo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { Brain } from '../../engine/Brain';
import { Copy, Check } from 'lucide-react';
import { DataType } from '../../types/payload';

import { ScalarView } from './views/ScalarView';
import { GridView } from './views/GridView';
import { ColorView } from './views/ColorView';
import { FormulaView } from './views/FormulaView';

export type ResultViewMode = 'auto' | 'text' | 'grid' | 'color' | 'formula';

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

    // Node state derived from graph data
    const precision = typeof data.precision === 'number' ? data.precision : -1;
    const unitStr = data.unit as string | undefined;
    const viewMode = (data.viewMode as ResultViewMode) || 'auto';
    const depth = (data.depth as string) || '8bit';

    const [copied, setCopied] = useState(false);

    // Parse incoming payload
    const payload = (typeof value === 'object' && value !== null && 'type' in value)
        ? value as import('../../types/payload').NodePayload
        : (value !== undefined ? PayloadUtils.wrap(value) : null);

    const rawValue = payload ? PayloadUtils.unwrap(payload) : null;
    const isError = payload?.type === DataType.Error;
    const errorStr = isError ? String(payload?.meta?.error || 'Error') : '';

    // Determine effective view mode
    let effectiveMode: 'text' | 'grid' | 'color' | 'formula' = 'text';

    if (viewMode === 'auto') {
        if (payload?.type === DataType.Matrix) effectiveMode = 'grid';
        else if (payload?.type === DataType.Object && rawValue && typeof rawValue === 'object' && 'hex' in (rawValue as object)) effectiveMode = 'color';
        else effectiveMode = 'text';
    } else {
        effectiveMode = viewMode;
    }

    // Prepare data for specific views
    let matrixData: unknown[][] = [];
    if (effectiveMode === 'grid') {
        if (Array.isArray(rawValue)) {
            matrixData = rawValue;
        } else if (typeof rawValue === 'object' && rawValue !== null) {
            const r = rawValue as any;
            if (r.mathjs === 'Matrix') matrixData = r.data || [];
            else if (r.toArray) matrixData = r.toArray();
            else matrixData = [[rawValue]]; // Wrap object in 1x1
        } else if (rawValue !== undefined && rawValue !== null) {
            matrixData = [[rawValue]]; // Wrap scalar in 1x1
        }
    }

    let formulaStr = '';
    if (effectiveMode === 'formula' && payload) {
        if (payload.symbol) formulaStr = PayloadUtils.stringifySymbol(payload.symbol);
        else formulaStr = String(rawValue);
    }

    // Determine type color for scalar/text mode
    let dataTypeColor = 'text-zinc-400';
    switch (payload?.type) {
        case DataType.Scalar: dataTypeColor = 'text-(--color-scalar)'; break;
        case DataType.String: dataTypeColor = 'text-(--color-string)'; break;
        case DataType.Matrix: dataTypeColor = 'text-(--color-matrix)'; break;
        case DataType.Boolean: dataTypeColor = 'text-(--color-boolean)'; break;
    }

    // --- Actions ---

    const copyToClipboard = useCallback(() => {
        let copyStr = '';
        if (isError) copyStr = errorStr;
        else if (effectiveMode === 'grid') copyStr = JSON.stringify(matrixData);
        else if (effectiveMode === 'color') copyStr = (rawValue as any)?.hex || '';
        else if (effectiveMode === 'formula') copyStr = formulaStr;
        else copyStr = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);

        if (copyStr && copyStr !== '[object Object]') {
            navigator.clipboard.writeText(copyStr);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [isError, errorStr, effectiveMode, matrixData, rawValue, formulaStr]);

    const handlePrecisionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { precision: parseInt(e.target.value) } }
        });
    }, [id]);

    const handleViewModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { viewMode: e.target.value as ResultViewMode } }
        });
    }, [id]);

    const handleDepthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { depth: e.target.value } }
        });
    }, [id]);

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="p-3 flex flex-col gap-2 min-w-[140px]">
                {/* Header Controls */}
                <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-1 overflow-hidden">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold shrink-0">Result</label>
                        {payload?.symbol && effectiveMode !== 'formula' && (
                            <button
                                onClick={() => handleViewModeChange({ target: { value: 'formula' } } as any)}
                                className="text-[8px] bg-(--color-math)/20 text-(--color-math) px-1 rounded hover:bg-(--color-math)/40 transition-colors"
                                title="Has Formula Trace"
                            >
                                ƒx
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <select
                            className="nodrag bg-transparent text-[9px] text-zinc-500 border border-zinc-700/50 rounded-xs outline-none cursor-pointer hover:bg-zinc-800 transition-colors uppercase font-bold"
                            value={viewMode}
                            onChange={handleViewModeChange}
                        >
                            <option value="auto">Auto</option>
                            <option value="text">Text</option>
                            <option value="grid">Grid</option>
                            <option value="color">Color</option>
                            <option value="formula">Formula</option>
                        </select>

                        {effectiveMode !== 'formula' && effectiveMode !== 'color' && (
                            <select
                                className="nodrag bg-transparent text-[9px] text-zinc-500 border border-zinc-700/50 rounded-xs outline-none cursor-pointer hover:bg-zinc-800 transition-colors uppercase font-bold"
                                value={precision}
                                onChange={handlePrecisionChange}
                            >
                                <option value={-1}>Auto</option>
                                {[0, 1, 2, 3, 4, 5, 6, 8, 10].map(p => (
                                    <option key={p} value={p}>{p} d.p.</option>
                                ))}
                            </select>
                        )}

                        <button
                            onClick={copyToClipboard}
                            className={`nodrag p-1 rounded hover:bg-zinc-800 transition-colors ${copied ? 'text-green-500' : 'text-zinc-500'}`}
                            title="Copy Value"
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className={`w-full min-h-[44px] flex items-center justify-center border border-zinc-800/50 rounded-lg bg-black/20 transition-colors ${isError ? 'border-red-900/30' : ''} ${effectiveMode === 'text' ? 'px-3 py-2 justify-end' : ''}`}>
                    {isError ? (
                        <div className="font-mono truncate text-red-500 text-sm py-2 px-3">{errorStr}</div>
                    ) : !payload ? (
                        <div className="font-mono truncate text-zinc-500 text-sm py-2 px-3">...</div>
                    ) : (
                        <>
                            {effectiveMode === 'text' && <ScalarView rawValue={rawValue} precision={precision} unitStr={unitStr} dataTypeColor={dataTypeColor} isError={isError} />}
                            {effectiveMode === 'grid' && <GridView grid={matrixData} precision={precision} />}
                            {effectiveMode === 'color' && <ColorView payload={payload} depth={depth} onDepthChange={handleDepthChange} />}
                            {effectiveMode === 'formula' && <FormulaView formula={formulaStr} />}
                        </>
                    )}
                </div>
            </div>
        </BaseNode>
    );
});

ResultNode.displayName = 'ResultNode';
