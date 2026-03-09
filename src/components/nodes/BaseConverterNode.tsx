'use client';

import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { HandleConfig } from '../../types/NodeDefinition';
import { Brain } from '../../engine/Brain';

// Define bases options
const BASES = ['BIN', 'OCT', 'DEC', 'DUO', 'HEX'] as const;

export const BaseConverterNode = memo((props: NodeProps) => {
    const { id, data } = props;

    // Standard handles for 1-in-1-out
    const handles: HandleConfig[] = [
        { id: 'in', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'unit' }
    ];

    const currentBase = (data.base as string) || 'HEX';

    const handleBaseClick = (base: string) => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: {
                    base
                }
            }
        });
    };

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-2 min-w-[160px]">
                <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                        Target Base
                    </label>
                    <span className="text-[10px] font-mono text-cyan-400">
                        {currentBase}
                    </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                    {BASES.map(base => {
                        const isActive = currentBase === base;
                        return (
                            <button
                                key={base}
                                className={`
                                    nodrag px-2 py-1.5 rounded text-[10px] font-bold font-mono transition-all duration-200
                                    ${isActive
                                        ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                                        : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                                    }
                                `}
                                onClick={() => handleBaseClick(base)}
                            >
                                {base}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-1 flex items-center justify-center gap-1.5 opacity-40">
                    <div className="h-px w-8 bg-zinc-700" />
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest">
                        Format
                    </span>
                    <div className="h-px w-8 bg-zinc-700" />
                </div>
            </div>
        </BaseNode>
    );
});

BaseConverterNode.displayName = 'BaseConverterNode';
