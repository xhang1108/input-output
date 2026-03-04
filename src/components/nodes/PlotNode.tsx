import { memo, useMemo, useRef, useCallback } from 'react';
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
    const viewMode = (data.viewMode as 'line' | 'bar' | 'scatter' | 'area' | 'vector' | 'heatmap' | 'hist') || 'line';

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
                    if (Array.isArray(parsed) && Array.isArray(parsed[0]) && parsed[0].length > 5) {
                        errors.push(`${seriesName}: Dimension mismatch (Matrix columns ${parsed[0].length} > 4). Only X, Y, U, V, Z are mapped.`);
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
    const hasSize = useMemo(() => plotData.table.length > 0 && plotData.table.some(pt => pt.size !== undefined), [plotData.table]);

    const spec = useMemo(() => {
        // Debugging logs
        console.log('[PlotNode] dualAxis:', data.dualAxis);
        console.log('[PlotNode] table length:', plotData.table.length);
        if (plotData.table.length > 0) {
            console.log('[PlotNode] unique series:', Array.from(new Set(plotData.table.map(p => p.series))));
        }

        const xDomain = [data.minX ?? -10, data.maxX ?? 10];
        const seriesNames = Array.from(new Set(plotData.table.map(p => p.series)));

        let mark: any;
        let encoding: any;
        let layer: any[] | undefined;
        let resolve: any;

        if (viewMode === 'heatmap') {
            const heatValues = plotData.table.filter(p => p.z !== undefined);
            // Derive exact step from sorted distinct x coords to match grid spacing
            const sortedX = Array.from(new Set(heatValues.map(p => p.x))).sort((a, b) => a - b);
            const binStep = sortedX.length > 1 ? Math.round((sortedX[1] - sortedX[0]) * 10000) / 10000 : 1;

            return {
                $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
                width: 'container',
                height: 'container',
                autosize: { type: 'fit', contains: 'padding' },
                background: 'transparent',
                data: { values: heatValues },
                mark: { type: 'rect', tooltip: true },
                encoding: {
                    x: {
                        field: 'x', type: 'quantitative',
                        bin: { step: binStep },
                        axis: { title: 'X', titleColor: '#71717a', labelColor: '#52525b', gridColor: '#27272a' }
                    },
                    y: {
                        field: 'y', type: 'quantitative',
                        bin: { step: binStep },
                        axis: { title: 'Y', titleColor: '#71717a', labelColor: '#52525b', gridColor: '#27272a' }
                    },
                    color: {
                        field: 'z', type: 'quantitative', aggregate: 'mean',
                        scale: { scheme: 'viridis' },
                        legend: { title: 'Z', labelColor: '#a1a1aa', titleColor: '#a1a1aa' }
                    }
                },
                config: { view: { stroke: 'transparent' } }
            };
        }

        if (viewMode === 'hist') {
            return {
                $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
                width: 'container',
                height: 'container',
                autosize: { type: 'fit', contains: 'padding' },
                background: 'transparent',
                data: { values: plotData.table },
                mark: { type: 'bar', opacity: 0.8 },
                encoding: {
                    x: { field: 'y', type: 'quantitative', bin: { maxbins: 40 }, axis: { title: 'Value', titleColor: '#71717a', labelColor: '#52525b', grid: false } },
                    y: { aggregate: 'count', type: 'quantitative', axis: { title: 'Count', titleColor: '#71717a', labelColor: '#52525b', gridColor: '#27272a' } },
                    color: seriesNames.length > 1 ? { field: 'series', type: 'nominal', scale: { range: ['#b084e9', '#34d399', '#38bdf8', '#fbbf24', '#f87171'] }, legend: { title: null, labelColor: '#a1a1aa', orient: 'top', direction: 'horizontal' } } : { value: '#b084e9' }
                },
                config: { view: { stroke: 'transparent' } }
            };
        }

        if (viewMode === 'vector') {
            mark = {
                type: 'point',
                shape: 'wedge',
                stroke: true,
                filled: true
            };
            encoding = {
                x: { field: 'x', type: 'quantitative', scale: { domain: xDomain } },
                y: { field: 'y', type: 'quantitative', scale: (data.minY !== undefined && data.maxY !== undefined) ? { domain: [data.minY, data.maxY] } : undefined },
                angle: { field: 'angle', type: 'quantitative', scale: { domain: [0, 360], range: [0, 360] } },
                size: { field: 'magnitude', type: 'quantitative', scale: { range: [50, 500] } },
                color: { field: 'magnitude', type: 'quantitative', scale: { scheme: 'viridis' } }
            };

            // Transform u,v to angle and magnitude for Vega-Lite wedge
            const vectorTable = plotData.table.map(p => {
                const angle = (Math.atan2(p.v || 0, p.u || 0) * 180) / Math.PI;
                const magnitude = Math.sqrt((p.u || 0) ** 2 + (p.v || 0) ** 2);
                return { ...p, angle: 90 - angle, magnitude }; // 90-angle because wedge 0 is up
            });

            return {
                $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
                width: 'container',
                height: 'container',
                autosize: { type: 'fit', contains: 'padding' },
                background: 'transparent',
                data: { values: vectorTable },
                mark,
                encoding,
                config: { view: { stroke: 'transparent' } }
            };
        }

        mark = {
            type: viewMode === 'scatter' ? (hasSize ? 'circle' : 'point') : viewMode === 'bar' ? 'bar' : viewMode === 'area' ? 'area' : 'line',
            color: '#b084e9',
            interpolate: 'monotone',
            invalid: 'filter',
            tooltip: true,
            point: (viewMode === 'line' && hasSize) ? { filled: true } : false
        };

        if (data.dualAxis && viewMode === 'line' && seriesNames.length >= 2) {
            const uniqueSeries = Array.from(new Set(plotData.table.map(p => p.series)));
            const series1 = uniqueSeries[0];
            const series2 = uniqueSeries[1];
            const seriesrest = uniqueSeries.slice(2);

            encoding = {
                x: {
                    field: 'x',
                    type: 'quantitative',
                    scale: { domain: xDomain },
                    axis: {
                        labelColor: '#52525b',
                        labelFont: 'Roboto Mono',
                        labelFontSize: 9,
                        gridColor: {
                            condition: { test: 'datum.value === 0', value: '#71717a' },
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
                    scale: { range: ['#b084e9', '#34d399', '#38bdf8', '#fbbf24', '#f87171'] }
                }
            };

            layer = [
                {
                    mark,
                    transform: [{ filter: { field: 'series', equal: series1 } }],
                    params: [
                        {
                            name: 'grid',
                            select: {
                                type: 'interval',
                                encodings: ['x']
                            },
                            bind: 'scales',
                        }
                    ],
                    encoding: {
                        y: {
                            field: 'y',
                            type: 'quantitative',
                            axis: {
                                labelColor: '#b084e9',
                                labelFont: 'Roboto Mono',
                                labelFontSize: 9,
                                gridColor: {
                                    condition: { test: 'datum.value === 0', value: '#71717a' },
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
                                title: series1,
                                titleColor: '#b084e9',
                                titleFontWeight: 'bold',
                                titleFontSize: 10
                            }
                        }
                    }
                },
                {
                    mark,
                    transform: [{ filter: { field: 'series', equal: series2 } }],
                    encoding: {
                        y: {
                            field: 'y',
                            type: 'quantitative',
                            axis: {
                                orient: 'right',
                                labelColor: '#34d399',
                                labelFont: 'Roboto Mono',
                                labelFontSize: 9,
                                grid: false,
                                domain: true,
                                domainColor: '#71717a',
                                tickAmount: 5,
                                title: series2,
                                titleColor: '#34d399',
                                titleFontWeight: 'bold',
                                titleFontSize: 10
                            }
                        }
                    }
                }
            ];

            // If there's more than 2 series, adding them to the second Y axis but hiding their axis labels
            if (seriesrest.length > 0) {
                layer.push({
                    mark,
                    transform: [{ filter: { field: 'series', oneOf: seriesrest } }],
                    encoding: {
                        y: {
                            field: 'y',
                            type: 'quantitative',
                            axis: null // Hide axis for remaining series
                        }
                    }
                });
            }

            resolve = {
                scale: { y: 'independent' }
            };
        } else {
            // Standard Single Axis Encoding
            encoding = {
                x: {
                    field: 'x',
                    type: 'quantitative',
                    scale: { domain: xDomain },
                    axis: {
                        labelColor: '#52525b',
                        labelFont: 'Roboto Mono',
                        labelFontSize: 9,
                        gridColor: {
                            condition: { test: 'datum.value === 0', value: '#71717a' },
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
                y: {
                    field: 'y',
                    type: 'quantitative',
                    scale: (data.minY !== undefined && data.maxY !== undefined)
                        ? { domain: [data.minY, data.maxY] }
                        : undefined,
                    axis: {
                        labelColor: '#52525b',
                        labelFont: 'Roboto Mono',
                        labelFontSize: 9,
                        gridColor: {
                            condition: { test: 'datum.value === 0', value: '#71717a' },
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
                        range: ['#b084e9', '#34d399', '#38bdf8', '#fbbf24', '#f87171']
                    }
                }
            };
        }

        const baseSpec: any = {
            $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
            width: 'container',
            height: 'container',
            autosize: { type: 'fit', contains: 'padding' },
            background: 'transparent',
            data: { values: plotData.table },
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
                    disable: plotData.table.length > 0 && new Set(plotData.table.map(p => p.series)).size <= 1
                }
            }
        };

        if (layer) {
            baseSpec.layer = layer;
            baseSpec.resolve = resolve;
        } else {
            baseSpec.mark = mark;
            // Only add params at top level for non-layered view
            baseSpec.params = [
                {
                    name: 'grid',
                    select: {
                        type: 'interval',
                        encodings: ['x']
                    },
                    bind: 'scales',
                }
            ];
        }
        // Set encoding once
        baseSpec.encoding = encoding;

        // If size field detected in data, add the encoding
        if (hasSize) {
            const sizeEncoding = {
                field: 'size',
                type: 'quantitative',
                legend: null,
                scale: { range: [20, 2000] }
            };

            if (layer) {
                layer.forEach((l: any) => {
                    if (!l.encoding) l.encoding = {};
                    l.encoding.size = sizeEncoding;
                });
            } else {
                baseSpec.encoding.size = sizeEncoding;
            }
        }

        console.log('[PlotNode] Generated Spec:', baseSpec);
        return baseSpec;
    }, [viewMode, hasSize, data.dualAxis, plotData.table, data.minX, data.maxX, data.minY, data.maxY]);

    const lastSyncedRange = useRef<[number, number] | null>(null);

    const handleGridSignal = useCallback((name: string, value: any) => {
        if (value && value.x) {
            const [newMinX, newMaxX] = value.x;

            // Avoid infinite loops by checking if significant change occurred relative to LAST SYNCED range
            const last = lastSyncedRange.current || [data.minX ?? -10, data.maxX ?? 10];
            const dx = Math.abs((newMinX as number) - (last[0] as number)) + Math.abs((newMaxX as number) - (last[1] as number));

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
    }, [props.id, data.minX, data.maxX]);

    const signalListeners = useMemo(() => ({
        grid: handleGridSignal
    }), [handleGridSignal]);

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
                <div className="flex gap-2 p-2 bg-zinc-900/80 border-b border-zinc-800/50 justify-between items-center">
                    <div className="flex flex-wrap gap-1 border border-zinc-700/50 rounded p-0.5 overflow-hidden w-full max-w-[220px]">
                        {['line', 'bar', 'scatter', 'area', 'vector', 'heatmap', 'hist'].map(m => (
                            <button
                                key={m}
                                onClick={() => {
                                    const brain = require('../../engine/Brain').Brain.getInstance();
                                    brain.applyTransaction({
                                        type: 'UPDATE_NODE_DATA',
                                        payload: { id: props.id, data: { viewMode: m } }
                                    });
                                }}
                                className={`px-2 py-0.5 text-[9px] uppercase font-bold transition-colors ${viewMode === m ? 'bg-purple-600/50 text-purple-200' : 'bg-transparent text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    {payloads.length > 1 && (
                        <button
                            onClick={() => {
                                const brain = require('../../engine/Brain').Brain.getInstance();
                                brain.applyTransaction({
                                    type: 'UPDATE_NODE_DATA',
                                    payload: { id: props.id, data: { dualAxis: !data.dualAxis } }
                                });
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold transition-colors border ${data.dualAxis
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                                : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:bg-zinc-700'
                                }`}
                            title="Dual Y-Axis (Compare ranges)"
                        >
                            Dual Axis
                        </button>
                    )}
                </div>

                <div
                    className="flex-1 relative select-none"
                    onWheel={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {plotData.table.length > 0 ? (
                        <VegaEmbed
                            spec={spec}
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
