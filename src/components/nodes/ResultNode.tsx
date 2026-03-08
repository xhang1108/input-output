import { memo, useState, useMemo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { FormulaRenderer } from '../../utils/FormulaRenderer';
import { Brain } from '../../engine/Brain';
import { Copy, Check, ChevronDown } from 'lucide-react';
import { DataType } from '../../types/payload';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

import { ScalarView } from './views/ScalarView';
import { GridView } from './views/GridView';
import { ColorView } from './views/ColorView';
import { FormulaView } from './views/FormulaView';
import { LatexView } from './views/LatexView';

export type ResultViewMode = 'auto' | 'text' | 'grid' | 'color' | 'formula' | 'latex';

const VIEW_MODE_ITEMS: CategorizedMenuItem[] = [
    { id: 'auto', label: 'Auto', category: 'General' },
    { id: 'text', label: 'Text', category: 'Display' },
    { id: 'grid', label: 'Grid', category: 'Display' },
    { id: 'color', label: 'Color', category: 'Display' },
    { id: 'formula', label: 'Formula', category: 'Symbolic' },
    { id: 'latex', label: 'LaTeX', category: 'Symbolic' },
];

const PRECISION_ITEMS: CategorizedMenuItem[] = [
    { id: '-1', label: 'Auto', category: 'Precision' },
    ...[0, 1, 2, 3, 4, 5, 6, 8, 10].map(p => ({
        id: String(p),
        label: `${p} d.p.`,
        category: 'Precision'
    })),
];

export const ResultNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const viewMenu = useNodeMenu();
    const precMenu = useNodeMenu();

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
    const payload = (typeof value === 'object' && value !== null && 'type' in value)
        ? value as import('../../types/payload').NodePayload
        : (value !== undefined ? PayloadUtils.wrap(value) : null);

    const unitStr = payload?.meta?.unit || (data.unit as string | undefined);
    const viewMode = (data.viewMode as ResultViewMode) || 'auto';
    const depth = (data.depth as string) || '8bit';

    const [copied, setCopied] = useState(false);

    const rawValue = payload ? PayloadUtils.unwrap(payload) : null;
    const isError = payload?.type === DataType.Error;
    const errorStr = isError ? String(payload?.meta?.error || 'Error') : '';

    let effectiveMode: 'text' | 'grid' | 'color' | 'formula' | 'latex' = 'text';

    if (viewMode === 'auto') {
        if (payload?.type === DataType.Array || payload?.type === DataType.Matrix) effectiveMode = 'grid';
        else if (payload?.type === DataType.Symbolic) effectiveMode = 'formula';
        else if (payload?.type === DataType.Object && rawValue && typeof rawValue === 'object' && 'hex' in (rawValue as object)) effectiveMode = 'color';
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
        if (payload.symbol) formulaStr = (effectiveMode === 'latex') ? FormulaRenderer.render(payload.symbol) : PayloadUtils.stringifySymbol(payload.symbol);
        else formulaStr = String(rawValue);
    }

    let dataTypeColor = 'text-zinc-400';
    switch (payload?.type) {
        case DataType.Scalar: dataTypeColor = 'text-(--color-scalar)'; break;
        case DataType.String: dataTypeColor = 'text-(--color-string)'; break;
        case DataType.Array:
        case DataType.Matrix: dataTypeColor = 'text-(--color-matrix)'; break;
        case DataType.Boolean: dataTypeColor = 'text-(--color-boolean)'; break;
        case DataType.Symbolic: dataTypeColor = 'text-[var(--color-symbolic,#b084e9)]'; break;
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

    const handlePrecisionSelect = useCallback((item: CategorizedMenuItem) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { precision: parseInt(item.id) } }
        });
        precMenu.closeMenu();
    }, [id, precMenu]);

    const handleViewModeSelect = useCallback((item: CategorizedMenuItem) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { viewMode: item.id as ResultViewMode } }
        });
        viewMenu.closeMenu();
    }, [id, viewMenu]);

    const handleDepthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { depth: e.target.value } }
        });
    }, [id]);

    const currentModeLabel = VIEW_MODE_ITEMS.find(v => v.id === viewMode)?.label || viewMode;
    const currentPrecLabel = precision === -1 ? 'Auto' : `${precision} d.p.`;

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="p-3 flex flex-col gap-2 min-w-[140px] max-w-[500px]">
                <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-1 overflow-hidden">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold shrink-0">Result</label>
                        {payload?.symbol && effectiveMode !== 'formula' && (
                            <button
                                onClick={() => handleViewModeSelect({ id: 'formula' } as any)}
                                className="text-[8px] bg-math/20 text-math px-1 rounded-sm hover:bg-math/40 transition-colors"
                                title="Has Formula Trace"
                            >
                                ƒx
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            className="nodrag bg-transparent text-[9px] text-zinc-500 border border-zinc-700/50 rounded-xs px-1.5 py-0.5 outline-none cursor-pointer hover:bg-zinc-800 transition-colors uppercase font-bold flex items-center gap-1"
                            onClick={viewMenu.handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {currentModeLabel}
                            <ChevronDown size={8} />
                        </button>

                        {effectiveMode !== 'formula' && effectiveMode !== 'latex' && effectiveMode !== 'color' && (
                            <button
                                className="nodrag bg-transparent text-[9px] text-zinc-500 border border-zinc-700/50 rounded-xs px-1.5 py-0.5 outline-none cursor-pointer hover:bg-zinc-800 transition-colors uppercase font-bold flex items-center gap-1"
                                onClick={precMenu.handleTrigger}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                {currentPrecLabel}
                                <ChevronDown size={8} />
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

                <div className={`w-full min-h-[44px] overflow-x-auto flex items-center justify-center border border-zinc-800/50 rounded-lg bg-black/20 transition-colors ${isError ? 'border-red-900/30' : ''} ${effectiveMode === 'text' ? 'px-3 py-2 justify-end' : ''}`}>
                    {isError ? (
                        <div className="font-mono break-all whitespace-pre-wrap text-red-500 text-sm py-2 px-3">{errorStr}</div>
                    ) : !payload ? (
                        <div className="font-mono break-all whitespace-pre-wrap text-zinc-500 text-sm py-2 px-3">...</div>
                    ) : (
                        <>
                            {effectiveMode === 'text' && <ScalarView rawValue={rawValue} precision={precision} unitStr={unitStr} dataTypeColor={dataTypeColor} isError={isError} />}
                            {effectiveMode === 'grid' && <GridView grid={matrixData} precision={precision} />}
                            {effectiveMode === 'color' && <ColorView payload={payload} depth={depth} onDepthChange={handleDepthChange} />}
                            {effectiveMode === 'formula' && <FormulaView formula={formulaStr} />}
                            {effectiveMode === 'latex' && <LatexView formula={formulaStr} />}
                        </>
                    )}
                </div>

                <CategorizedMenu
                    isOpen={viewMenu.menuOpen}
                    items={VIEW_MODE_ITEMS}
                    position={viewMenu.menuPos}
                    trigger={viewMenu.trigger}
                    onClose={viewMenu.closeMenu}
                    onSelect={handleViewModeSelect}
                    placeholder="Select View..."
                    width="28"
                />

                <CategorizedMenu
                    isOpen={precMenu.menuOpen}
                    items={PRECISION_ITEMS}
                    position={precMenu.menuPos}
                    trigger={precMenu.trigger}
                    onClose={precMenu.closeMenu}
                    onSelect={handlePrecisionSelect}
                    placeholder="Set Precision..."
                    width="28"
                />
            </div>
        </BaseNode>
    );
});

ResultNode.displayName = 'ResultNode';
