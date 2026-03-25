'use client';

import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { HandleConfig } from '../../types/NodeDefinition';
import { useBrain } from '../../context/BrainContext';

const BASES = ['BIN', 'QUAT', 'OCT', 'DEC', 'DUO', 'HEX'] as const;

export const BaseConverterNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

    const handles: HandleConfig[] = [
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' },
        { id: 'out_a', type: 'source', position: Position.Right, variant: 'single', dataType: 'unit' }
    ];

    const currentToBase = Number(data.toBase || 16);

    const baseMap: Record<string, number> = {
        'BIN': 2,
        'QUAT': 4,
        'OCT': 8,
        'DEC': 10,
        'DUO': 12,
        'HEX': 16
    };

    const handleBaseClick = (base: number) => {
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: {
                    toBase: base
                }
            }
        });
    };

    const nodeData = { ...data, handles };

    const renderBaseButtons = (activeBase: number) => (
        <div className="grid grid-cols-6 gap-1">
            {BASES.map(label => {
                const baseVal = baseMap[label];
                const isActive = activeBase === baseVal;
                return (
                    <button
                        key={label}
                        className={`
                            nodrag py-1 rounded text-[9px] font-bold font-mono transition-all duration-200 border
                            ${isActive
                                ? 'bg-cyan-950 text-cyan-400 border-cyan-500/50 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                                : 'bg-zinc-900 text-zinc-600 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-400 hover:border-zinc-700'
                            }
                        `}
                        onClick={() => handleBaseClick(baseVal)}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-3 p-1 min-w-[180px]">
                {/* To Base Section */}
                <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">
                            Convert To
                        </label>
                        <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/30 px-1 rounded border border-cyan-900/50">
                            Base {currentToBase}
                        </span>
                    </div>
                    {renderBaseButtons(currentToBase)}
                </div>

                <div className="flex items-center gap-2 px-1 opacity-30 mt-1">
                    <div className="h-px flex-1 bg-linear-to-r from-transparent via-zinc-800 to-transparent" />
                    <span className="text-[7.5px] text-zinc-500 uppercase tracking-[0.25em] font-medium">Detect Source via Unit</span>
                    <div className="h-px flex-1 bg-linear-to-r from-transparent via-zinc-800 to-transparent" />
                </div>
            </div>
        </BaseNode>
    );
});

BaseConverterNode.displayName = 'BaseConverterNode';
