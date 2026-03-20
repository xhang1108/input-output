'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { FormulaRenderer } from '../../utils/FormulaRenderer';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { Copy, Check, ChevronDown, Hash, Variable } from 'lucide-react';
import { DataType } from '../../types/payload';
import { NodeOpSelect } from './NodeOpSelect';
import { ScalarView } from './views/ScalarView';
import { GridView } from './views/GridView';
import { ColorView } from './views/ColorView';
import { FormulaView } from './views/FormulaView';
import { LatexView } from './views/LatexView';

export type ResultViewMode = 'auto' | 'text' | 'grid' | 'color' | 'formula' | 'latex';

export const ResultNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

    const nodeData = data;
    const value = data.value;

    const precision = typeof data.precision === 'number' ? data.precision : -1;
    const payload = (typeof value === 'object' && value !== null && 'type' in value)
        ? value as import('../../types/payload').NodePayload
        : (value !== undefined ? PayloadUtils.wrap(value) : null);

    const unitStr = payload?.meta?.unit || (data.unit as string | undefined);
    const viewMode = (data.viewMode as ResultViewMode) || 'auto';
    const depth = (data.depth as string) || '8bit';
    const expandSymbols = (data.expandSymbols as boolean) !== false; // Default to true

    const [copied, setCopied] = useState(false);

    const rawValue = payload ? PayloadUtils.unwrap(payload) : null;
    const isError = payload?.meta?.error !== undefined;
    const errorStr = isError ? String(payload?.meta?.error || 'Error') : '';

    let effectiveMode: 'text' | 'grid' | 'color' | 'formula' | 'latex' = 'text';

    if (viewMode === 'auto') {
        if (payload?.type === DataType.Array || payload?.type === DataType.Matrix) effectiveMode = 'grid';
        else if (payload?.type === DataType.Symbolic) effectiveMode = 'formula';
        else if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) && 'hex' in (rawValue as object)) effectiveMode = 'color';
        else effectiveMode = 'text';
    } else {
        effectiveMode = viewMode;
    }

    let matrixData: unknown[][] = [];
    if (effectiveMode === 'grid') {
        if (Array.isArray(rawValue)) {
            matrixData = rawValue;
        } else if (typeof rawValue === 'object' && rawValue !== null) {
            const r = rawValue as any;
            if (r.mathjs === 'Matrix') matrixData = r.data || [];
            else if (r.toArray) matrixData = r.toArray();
            else matrixData = [[rawValue]];
        } else if (rawValue !== undefined && rawValue !== null) {
            matrixData = [[rawValue]];
        }
    }

    let formulaStr = '';
    if ((effectiveMode === 'formula' || effectiveMode === 'latex') && payload) {
        if (payload.symbol) {
            formulaStr = (effectiveMode === 'latex') 
                ? FormulaRenderer.render(payload.symbol, { expandSymbols }) 
                : PayloadUtils.stringifySymbol(payload.symbol, { expandSymbols });
        } else if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) && (rawValue as any).latex) {
            formulaStr = PayloadUtils.unwrap((rawValue as any).latex) as string;
        } else {
            formulaStr = String(rawValue);
        }
    }

    let dataTypeColor = 'text-zinc-400';
    switch (payload?.type) {
        case DataType.Scalar: dataTypeColor = 'text-(--color-scalar)'; break;
        case DataType.String: dataTypeColor = 'text-(--color-string)'; break;
        case DataType.Array:
        case DataType.Matrix: dataTypeColor = 'text-(--color-matrix)'; break;
        case DataType.Boolean: dataTypeColor = 'text-(--color-boolean)'; break;
        case DataType.Symbolic: dataTypeColor = 'text-(--color-symbolic)'; break;
    }

    const copyToClipboard = useCallback(() => {
        let copyStr = '';
        if (isError) copyStr = errorStr;
        else if (effectiveMode === 'grid') copyStr = JSON.stringify(matrixData);
        else if (effectiveMode === 'color') copyStr = (rawValue as any)?.hex || '';
        else if (effectiveMode === 'formula') copyStr = formulaStr;
        else if (effectiveMode === 'latex') copyStr = formulaStr;
        else copyStr = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);

        if (copyStr && copyStr !== '[object Object]') {
            navigator.clipboard.writeText(copyStr);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [isError, errorStr, effectiveMode, matrixData, rawValue, formulaStr]);


    return (
        <BaseNode {...props} data={nodeData}>
            <div className="p-3 flex flex-col gap-2 min-w-[140px] max-w-[500px]">
                <div className="flex justify-between items-center bg-zinc-800/20 px-2 py-1 -mx-3 -mt-3 mb-1 border-b border-zinc-800/40 shrink-0">
                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Result Info</span>
                    <div className="flex items-center gap-1">
                        {(effectiveMode === 'formula' || effectiveMode === 'latex') && (
                            <button
                                onClick={() => brain.applyTransaction({ 
                                    type: 'UPDATE_NODE_DATA', 
                                    payload: { id, data: { expandSymbols: !expandSymbols } } 
                                })}
                                className={cn(
                                    "nodrag p-1 rounded-sm transition-colors",
                                    expandSymbols ? "text-primary bg-primary/10" : "text-zinc-500 hover:bg-zinc-800"
                                )}
                                title={expandSymbols ? "Showing Values (5+5)" : "Showing Symbols (x+y)"}
                            >
                                {expandSymbols ? <Hash size={12} /> : <Variable size={12} />}
                            </button>
                        )}
                        <button
                            onClick={copyToClipboard}
                            className={`nodrag p-1 rounded-sm hover:bg-zinc-800 transition-colors ${copied ? 'text-green-500' : 'text-zinc-500'}`}
                            title="Copy Value"
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                    </div>
                </div>

                <div className={`w-full min-h-[44px] overflow-x-auto flex items-center justify-center border border-zinc-800/50 rounded-[10px] bg-black/20 transition-colors ${isError ? 'border-red-900/30' : ''} ${effectiveMode === 'text' ? 'px-3 py-2 justify-end' : ''}`}>
                    {isError ? (
                        <div className="font-mono break-all whitespace-pre-wrap text-red-500 text-sm py-2 px-3">{errorStr}</div>
                    ) : !payload ? (
                        <div className="font-mono break-all whitespace-pre-wrap text-zinc-500 text-sm py-2 px-3">...</div>
                    ) : (
                        <>
                            {effectiveMode === 'text' && <ScalarView rawValue={rawValue} precision={precision} unitStr={unitStr} dataTypeColor={dataTypeColor} isError={isError} />}
                            {effectiveMode === 'grid' && <GridView grid={matrixData} precision={precision} />}
                            {effectiveMode === 'color' && <ColorView payload={payload} depth={depth} onDepthChange={(e) => brain.applyTransaction({ type: 'UPDATE_NODE_DATA', payload: { id, data: { depth: e.target.value } } })} />}
                            {effectiveMode === 'formula' && <FormulaView formula={formulaStr} />}
                            {effectiveMode === 'latex' && <LatexView formula={formulaStr} />}
                        </>
                    )}
                </div>
                <div className="flex flex-col gap-2 pt-1 border-t border-zinc-800/30">
                    <div className="grid grid-cols-2 gap-2">
                        <NodeOpSelect 
                            nodeId={id} 
                            defId="OT-01" 
                            paramId="viewMode" 
                            data={data} 
                            label="View Mode"
                            width="36"
                        />
                        {effectiveMode !== 'formula' && effectiveMode !== 'latex' && effectiveMode !== 'color' && (
                            <NodeOpSelect 
                                nodeId={id} 
                                defId="OT-01" 
                                paramId="precision" 
                                data={data} 
                                label="Precision"
                                width="36"
                            />
                        )}
                    </div>
                </div>
            </div>
        </BaseNode>
    );
});

ResultNode.displayName = 'ResultNode';
