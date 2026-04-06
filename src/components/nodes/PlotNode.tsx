import { memo, useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { useBrain } from '../../context/BrainContext';
import { PayloadUtils } from '../../utils/PayloadUtils';
import dynamic from 'next/dynamic';
import { NumericInput } from '../common/NumericInput';

// Next.js SSR guard: Prevent C++ native canvas addon from crashing OpenNext edge/worker bundles
const VegaEmbed = dynamic(
    () => import('react-vega').then((mod) => mod.VegaEmbed),
    { ssr: false }
);

export const PlotNode = memo((props: NodeProps) => {
    const { data, id } = props;
    const brain = useBrain();

    // 3.1 Mode Switching Logic
    const viewMode = (data.viewMode as 'line' | 'bar' | 'scatter' | 'area' | 'vector' | 'heatmap' | 'hist') || 'line';

    // Read pre-computed plot data from the engine (IO-14 evaluator)
    // Engine stores results in data.value.meta.plotPoints and meta.plotErrors
    const engineValue = data.value as any;
    const plotPoints: any[] = engineValue?.meta?.plotPoints || [];
    const plotErrors: string[] = engineValue?.meta?.plotErrors || [];

    const plotData = useMemo(() => ({
        table: plotPoints,
        errors: plotErrors,
    }), [plotPoints, plotErrors]);

    // Infer payload count for UI features (e.g., Dual Axis button)
    const seriesCount = useMemo(() =>
        new Set(plotPoints.map((p: any) => p.series)).size,
        [plotPoints]
    );


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
                        axis: { title: 'X', titleColor: 'var(--color-zinc-500)', labelColor: 'var(--color-zinc-600)', gridColor: 'var(--color-zinc-800)' }
                    },
                    y: {
                        field: 'y', type: 'quantitative',
                        bin: { step: binStep },
                        axis: { title: 'Y', titleColor: 'var(--color-zinc-500)', labelColor: 'var(--color-zinc-600)', gridColor: 'var(--color-zinc-800)' }
                    },
                    color: {
                        field: 'z', type: 'quantitative', aggregate: 'mean',
                        scale: { scheme: 'viridis' },
                        legend: { title: 'Z', labelColor: 'var(--color-zinc-400)', titleColor: 'var(--color-zinc-400)' }
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
                    x: { field: 'y', type: 'quantitative', bin: { maxbins: 40 }, axis: { title: 'Value', titleColor: 'var(--color-zinc-500)', labelColor: 'var(--color-zinc-600)', grid: false } },
                    y: { aggregate: 'count', type: 'quantitative', axis: { title: 'Count', titleColor: 'var(--color-zinc-500)', labelColor: 'var(--color-zinc-600)', gridColor: 'var(--color-zinc-800)' } },
                    color: seriesNames.length > 1 ? { field: 'series', type: 'nominal', scale: { range: ['#b084e9', '#34d399', '#38bdf8', '#fbbf24', '#f87171'] }, legend: { title: null, labelColor: 'var(--color-zinc-400)', orient: 'top', direction: 'horizontal' } } : { value: '#b084e9' }
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
                        labelColor: 'var(--color-zinc-600)',
                        labelFont: 'Roboto Mono',
                        labelFontSize: 9,
                        gridColor: {
                            condition: { test: 'datum.value === 0', value: 'var(--color-zinc-500)' },
                            value: 'var(--color-zinc-800)'
                        },
                        gridWidth: {
                            condition: { test: 'datum.value === 0', value: 1.5 },
                            value: 0.5
                        },
                        grid: true,
                        domain: true,
                        domainColor: 'var(--color-zinc-500)',
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
                                    condition: { test: 'datum.value === 0', value: 'var(--color-zinc-500)' },
                                    value: 'var(--color-zinc-800)'
                                },
                                gridWidth: {
                                    condition: { test: 'datum.value === 0', value: 1.5 },
                                    value: 0.5
                                },
                                grid: true,
                                domain: true,
                                domainColor: 'var(--color-zinc-500)',
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
                                domainColor: 'var(--color-zinc-500)',
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
                        labelColor: 'var(--color-zinc-600)',
                        labelFont: 'Roboto Mono',
                        labelFontSize: 9,
                        gridColor: {
                            condition: { test: 'datum.value === 0', value: 'var(--color-zinc-500)' },
                            value: 'var(--color-zinc-800)'
                        },
                        gridWidth: {
                            condition: { test: 'datum.value === 0', value: 1.5 },
                            value: 0.5
                        },
                        grid: true,
                        domain: true,
                        domainColor: 'var(--color-zinc-500)',
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
                        labelColor: 'var(--color-zinc-600)',
                        labelFont: 'Roboto Mono',
                        labelFontSize: 9,
                        gridColor: {
                            condition: { test: 'datum.value === 0', value: 'var(--color-zinc-500)' },
                            value: 'var(--color-zinc-800)'
                        },
                        gridWidth: {
                            condition: { test: 'datum.value === 0', value: 1.5 },
                            value: 0.5
                        },
                        grid: true,
                        domain: true,
                        domainColor: 'var(--color-zinc-500)',
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
                    labelColor: 'var(--color-zinc-400)',
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
    const focusedInput = useRef<string | null>(null);

    const handleGridSignal = useCallback((name: string, value: any) => {
        if (value && value.x) {
            const [newMinX, newMaxX] = value.x;

            // Avoid infinite loops by checking if significant change occurred relative to LAST SYNCED range
            const last = lastSyncedRange.current || [data.minX ?? -10, data.maxX ?? 10];
            const dx = Math.abs((newMinX as number) - (last[0] as number)) + Math.abs((newMaxX as number) - (last[1] as number));

            if (dx > 0.001) {
                // Update ref BEFORE transaction to block feedback re-renders from triggering another update
                lastSyncedRange.current = [Number(newMinX), Number(newMaxX)];

                // Update ref BEFORE transaction to block feedback re-renders from triggering another update
                lastSyncedRange.current = [Number(newMinX), Number(newMaxX)];

                brain.applyTransaction({
                    type: 'UPDATE_NODE_DATA',
                    payload: {
                        id: id,
                        data: {
                            minX: Number(Number(newMinX).toFixed(4)),
                            maxX: Number(Number(newMaxX).toFixed(4))
                        }
                    }
                });
            }
        }
    }, [id, data.minX, data.maxX, brain]);

    const signalListeners = useMemo(() => ({
        grid: handleGridSignal
    }), [handleGridSignal]);

    return (
        <BaseNode
            {...props}
            data={{
                ...data,
                handles: [
                    { id: 'in_a', type: 'target', position: Position.Left, variant: 'capsule', dataType: 'any', color: 'var(--color-any)' }
                ]
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
                                    brain.applyTransaction({
                                        type: 'UPDATE_NODE_DATA',
                                        payload: { id, data: { viewMode: m } }
                                    });
                                }}
                                className={`px-2 py-0.5 text-[9px] uppercase font-bold transition-colors ${viewMode === m ? 'bg-purple-600/50 text-purple-200' : 'bg-transparent text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    {seriesCount > 1 && (
                        <button
                            onClick={() => {
                                brain.applyTransaction({
                                    type: 'UPDATE_NODE_DATA',
                                    payload: { id, data: { dualAxis: !data.dualAxis } }
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
                    {engineValue && plotData.table.length === 0 && plotData.errors.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">No Data Points</div>
                        </div>
                    )}
                </div>

                {/* Sampling Controls */}
                <div className="flex gap-1 p-1.5 bg-zinc-900/50 border-t border-zinc-800/50 items-center text-[9px]">
                    <NumericInput 
                        label="Min X"
                        hideLabel={false}
                        value={typeof data.minX === 'number' ? data.minX : -10}
                        onChange={(val) => brain.applyTransaction({ type: 'UPDATE_NODE_DATA', payload: { id, data: { minX: val } } })}
                        className="flex-1"
                        inputClassName="h-6"
                    />
                    <NumericInput 
                        label="Max X"
                        hideLabel={false}
                        value={typeof data.maxX === 'number' ? data.maxX : 10}
                        onChange={(val) => brain.applyTransaction({ type: 'UPDATE_NODE_DATA', payload: { id, data: { maxX: val } } })}
                        className="flex-1"
                        inputClassName="h-6"
                    />
                    <NumericInput 
                        label="Pts"
                        hideLabel={false}
                        value={typeof data.points === 'number' ? data.points : 100}
                        onChange={(val) => brain.applyTransaction({ type: 'UPDATE_NODE_DATA', payload: { id, data: { points: val } } })}
                        className="flex-1"
                        inputClassName="h-6"
                    />
                </div>
            </div>
        </BaseNode>
    );
});

PlotNode.displayName = 'PlotNode';

