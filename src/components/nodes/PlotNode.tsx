import { memo, useMemo, useRef } from 'react';
import { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { PlottingUtils } from '../../utils/PlottingUtils';
import { VegaEmbed } from 'react-vega';

export const PlotNode = memo((props: NodeProps) => {
    const { data } = props;

    // React-Flow extracts all inputs as data.[handle_id] inside the engine
    // Assuming the node formula arrives at 'expr' or 'val'. Let's parse default handle or mapped expression.
    // BaseNode usually maps unhandled data sources natively to `data.in` or similar if single target.
    // The spec defined an input for formula matching to values.

    // 3.1 Mode Switching Logic
    const viewMode = data.viewMode || 'line'; // line | bar | scatter | area

    // 3.1 Data Aggregation Logic
    const payloads = useMemo(() => {
        // Helper to check if something is a valid payload or non-empty data
        const isValid = (v: any) => {
            if (v === null || v === undefined) return false;
            if (Array.isArray(v)) return v.length > 0;
            if (typeof v === 'object') {
                if ('type' in v) return true; // It's a payload
                return Object.keys(v).length > 0;
            }
            return true; // Scalars
        };

        // Engine computed result is primarily in data.value
        let base = isValid(data.value) ? data.value : (data.val || data.expr);

        // Extract if nested in handle map { in: [...], other: [...] }
        if (base && typeof base === 'object' && !Array.isArray(base) && !('type' in (base as any))) {
            const vals = Object.values(base).filter(v => v !== undefined);
            // Flatten if any of the values are arrays (capsule input)
            base = vals.flat(1);
        }

        let list: any[] = Array.isArray(base) ? base : [base];
        list = list.filter(isValid);

        // Deep unpack matrix or object wrappers if they contain payloads
        if (list.length === 1 && (list[0]?.type === 'matrix' || list[0]?.type === 'object') && Array.isArray(list[0].value)) {
            const inner = list[0].value;
            if (inner.length > 0 && typeof inner[0] === 'object' && 'type' in inner[0]) {
                list = inner;
            }
        }

        return list;
    }, [data.value, data.val, data.expr]);

    const plotData = useMemo(() => {
        if (payloads.length === 0) return { table: [], errors: [] };
        const allPoints: any[] = [];
        const errors: string[] = [];
        let seriesCount = 0;

        payloads.forEach((p, idx) => {
            if (!p) return;

            // 1. Check for engine-level errors
            if (typeof p === 'object' && 'type' in p && p.type === 'error') {
                errors.push(`Input ${idx + 1}: ${p.meta?.error || 'Unknown error'}`);
                return;
            }

            const parsed = PayloadUtils.unwrap(p);
            // Allow falsy but valid math values like 0 or empty string (which is handled later)
            if (parsed === null || parsed === undefined) return;

            let pts: any[] = [];
            const seriesName = (p as any).meta?.label || `Series ${idx + 1}`;

            try {
                if (typeof parsed === 'string') {
                    const minX = typeof data.minX === 'number' ? data.minX : -10;
                    const maxX = typeof data.maxX === 'number' ? data.maxX : 10;
                    const pointsCount = typeof data.points === 'number' ? data.points : 100;
                    pts = PlottingUtils.generateSymbolicPoints(parsed, minX, maxX, pointsCount);

                    // Logic: If symbolic points are all null/infinite, report as math error
                    const validY = pts.filter(pt => pt.y !== null);
                    if (pts.length > 0 && validY.length === 0) {
                        errors.push(`${seriesName}: All values are undefined/infinite (e.g. division by zero).`);
                    }
                } else {
                    // Detect dimension issues for matrix
                    if (Array.isArray(parsed) && Array.isArray(parsed[0]) && parsed[0].length > 3) {
                        errors.push(`${seriesName}: Dimension mismatch (Matrix columns ${parsed[0].length} > 3). Only X, Y, Size are mapped.`);
                    }
                    pts = PlottingUtils.mapDataPayload(parsed);
                }
            } catch (err: any) {
                errors.push(`${seriesName}: ${err.message || 'Evaluation Error'}`);
            }

            if (pts.length === 0 && !errors.some(e => e.startsWith(seriesName))) {
                // If it's a matrix/array but actually empty
                if (parsed && (Array.isArray(parsed) || typeof parsed === 'object')) {
                    errors.push(`${seriesName}: Input data is empty.`);
                }
            }

            // Add series label for multi-line support
            const validPts = pts.filter(pt =>
                pt.x !== null && pt.y !== null &&
                Number.isFinite(pt.x) && Number.isFinite(pt.y)
            ).map(pt => ({
                ...pt,
                series: seriesName
            }));

            if (validPts.length > 0) {
                allPoints.push(...validPts);
                seriesCount++;
            }
        });

        return { table: allPoints, errors };
    }, [payloads, data.minX, data.maxX, data.points]);

    // Vega-Lite Specification (Phase 2.2)
    const hasSize = plotData.table.length > 0 && plotData.table.some(pt => pt.size !== undefined);

    const spec: any = {
        $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
        width: 'container',
        height: 'container',
        autosize: { type: 'fit', contains: 'padding' },
        background: 'transparent',
        data: { name: 'table' },
        mark: {
            type: viewMode === 'scatter' ? (hasSize ? 'circle' : 'point') : viewMode === 'bar' ? 'bar' : viewMode === 'area' ? 'area' : 'line',
            color: '#b084e9',
            interpolate: 'monotone',
            invalid: 'filter',
            tooltip: true,
            // If it's a line but has size, maybe show points? 
            point: (viewMode === 'line' && hasSize) ? { filled: true } : false
        },
        encoding: {
            x: {
                field: 'x',
                type: 'quantitative',
                axis: {
                    labelColor: '#52525b',
                    labelFont: 'Roboto Mono',
                    labelFontSize: 9,
                    gridColor: {
                        condition: { test: 'datum.value === 0', value: '#71717a' }, // Zinc-500 (Medium Gray)
                        value: '#27272a' // Zinc-800 for normal grids
                    },
                    gridWidth: {
                        condition: { test: 'datum.value === 0', value: 1.5 },
                        value: 0.5
                    },
                    grid: true,
                    domain: true,
                    domainColor: '#71717a',
                    tickAmount: 5,
                    title: null
                }
            },
            y: {
                field: 'y',
                type: 'quantitative',
                axis: {
                    labelColor: '#52525b',
                    labelFont: 'Roboto Mono',
                    labelFontSize: 9,
                    gridColor: {
                        condition: { test: 'datum.value === 0', value: '#71717a' }, // Zinc-500
                        value: '#27272a'
                    },
                    gridWidth: {
                        condition: { test: 'datum.value === 0', value: 1.5 },
                        value: 0.5
                    },
                    grid: true,
                    domain: true,
                    domainColor: '#71717a',
                    tickAmount: 5,
                    title: null
                }
            },
            color: {
                field: 'series',
                type: 'nominal',
                scale: {
                    // Vibrant multi-series palette
                    range: ['#b084e9', '#34d399', '#38bdf8', '#fbbf24', '#f87171']
                }
            }
        },
        config: {
            view: { stroke: 'transparent' },
            legend: {
                title: null,
                labelColor: '#a1a1aa',
                labelFont: 'Inter',
                labelFontSize: 9,
                orient: 'top',
                direction: 'horizontal',
                offset: 5,
                padding: 0,
                // Automatically hide if only one series to keep UI clean
                disable: plotData.table.length > 0 && new Set(plotData.table.map(p => p.series)).size <= 1
            }
        }
    };

    // If size field detected in data, add the encoding
    if (hasSize) {
        spec.encoding.size = {
            field: 'size',
            type: 'quantitative',
            legend: null,
            scale: { range: [20, 2000] } // Better scaling for visibility
        };
    }

    const lastSyncedRange = useRef<[number, number] | null>(null);

    return (
        <BaseNode
            {...props}
            // 3.2 Dynamic Handles: Line mode supports multi-input via capsule
            handleVariants={{
                in: viewMode === 'line' ? 'capsule' : 'single'
            }}
        >
            <div className="w-[320px] bg-zinc-950/50 rounded-b-md relative flex flex-col" style={{ height: 240 }}>
                {/* 3.1 Mode Toggle UI */}
                <div className="flex gap-2 p-2 bg-zinc-900/80 border-b border-zinc-800/50 justify-center">
                    {['line', 'bar', 'scatter', 'area'].map(m => (
                        <button
                            key={m}
                            onClick={() => {
                                const brain = require('../../engine/Brain').Brain.getInstance();
                                brain.applyTransaction({
                                    type: 'UPDATE_NODE_DATA',
                                    payload: { id: props.id, data: { viewMode: m } }
                                });
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition-colors ${viewMode === m ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                }`}
                        >
                            {m}
                        </button>
                    ))}
                </div>

                <div
                    className="flex-1 relative select-none"
                    onWheel={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {plotData.table.length > 0 ? (
                        <VegaEmbed
                            spec={{
                                ...spec,
                                data: { values: plotData.table },
                                params: [
                                    {
                                        name: 'grid',
                                        select: 'interval',
                                        bind: 'scales',
                                    }
                                ],
                                encoding: {
                                    ...spec.encoding,
                                    x: {
                                        ...spec.encoding.x,
                                        scale: { domain: [data.minX ?? -10, data.maxX ?? 10] }
                                    },
                                    y: {
                                        ...spec.encoding.y,
                                        // Only bind Y scale if the user wants it, or default to auto
                                        scale: (data.minY !== undefined && data.maxY !== undefined)
                                            ? { domain: [data.minY, data.maxY] }
                                            : undefined
                                    }
                                }
                            }}
                            onNewView={(view: any) => {
                                // Listen to zoom/pan changes
                                view.addSignalListener('grid', (name: string, value: any) => {
                                    if (value && value.x) {
                                        const [newMinX, newMaxX] = value.x;

                                        // Avoid infinite loops by checking if significant change occurred relative to LAST SYNCED range
                                        const last = lastSyncedRange.current || [data.minX ?? -10, data.maxX ?? 10];
                                        const dx = Math.abs(Number(newMinX) - last[0]) + Math.abs(Number(newMaxX) - last[1]);

                                        if (dx > 0.001) {
                                            // Update ref BEFORE transaction to block feedback re-renders from triggering another update
                                            lastSyncedRange.current = [Number(newMinX), Number(newMaxX)];

                                            const brain = require('../../engine/Brain').Brain.getInstance();
                                            brain.applyTransaction({
                                                type: 'UPDATE_NODE_DATA',
                                                payload: {
                                                    id: props.id,
                                                    data: {
                                                        minX: Number(Number(newMinX).toFixed(4)),
                                                        maxX: Number(Number(newMaxX).toFixed(4))
                                                    }
                                                }
                                            });
                                        }
                                    }
                                });
                            }}
                            options={{ actions: false, renderer: 'svg' }}
                            style={{ width: '100%', height: '100%' }}
                        />
                    ) : null}

                    {/* Error Overlay (Phase Roadmap: Exceptional UI) */}
                    {plotData.errors.length > 0 && (
                        <div className="absolute inset-x-2 top-2 z-10 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="bg-red-500/10 border border-red-500/30 backdrop-blur-md rounded-md p-2 space-y-1">
                                {plotData.errors.map((err, i) => (
                                    <div key={i} className="flex items-start gap-2 text-[9px] text-red-400 font-medium">
                                        <div className="w-1 h-1 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                        <span>{String(err)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State Overlay - Only show if something is connected but no points */}
                    {payloads.length > 0 && plotData.table.length === 0 && plotData.errors.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">No Data Points</div>
                        </div>
                    )}
                </div>

                {/* Sampling Controls */}
                <div className="flex gap-1 p-1.5 bg-zinc-900/50 border-t border-zinc-800/50 items-center text-[9px]">
                    <div className="flex items-center gap-1 bg-zinc-950/50 px-1.5 py-0.5 rounded border border-zinc-800/50 flex-1">
                        <span className="text-zinc-500 font-bold uppercase">Min X</span>
                        <input
                            type="number"
                            value={(data.minX ?? -10) as string | number}
                            className="bg-transparent outline-none text-zinc-300 w-full text-center"
                            onChange={(e) => {
                                const brain = require('../../engine/Brain').Brain.getInstance();
                                brain.applyTransaction({
                                    type: 'UPDATE_NODE_DATA',
                                    payload: { id: props.id, data: { minX: Number(e.target.value) } }
                                });
                            }}
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-950/50 px-1.5 py-0.5 rounded border border-zinc-800/50 flex-1">
                        <span className="text-zinc-500 font-bold uppercase">Max X</span>
                        <input
                            type="number"
                            value={(data.maxX ?? 10) as string | number}
                            className="bg-transparent outline-none text-zinc-300 w-full text-center"
                            onChange={(e) => {
                                const brain = require('../../engine/Brain').Brain.getInstance();
                                brain.applyTransaction({
                                    type: 'UPDATE_NODE_DATA',
                                    payload: { id: props.id, data: { maxX: Number(e.target.value) } }
                                });
                            }}
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-950/50 px-1.5 py-0.5 rounded border border-zinc-800/50 flex-1">
                        <span className="text-zinc-500 font-bold uppercase">Pts</span>
                        <input
                            type="number"
                            value={(data.points ?? 100) as string | number}
                            className="bg-transparent outline-none text-zinc-300 w-full text-center"
                            onChange={(e) => {
                                const brain = require('../../engine/Brain').Brain.getInstance();
                                brain.applyTransaction({
                                    type: 'UPDATE_NODE_DATA',
                                    payload: { id: props.id, data: { points: Number(e.target.value) } }
                                });
                            }}
                        />
                    </div>
                </div>
            </div>
        </BaseNode>
    );
});

PlotNode.displayName = 'PlotNode';
