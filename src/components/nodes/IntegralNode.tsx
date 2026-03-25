import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow, Position } from '@xyflow/react';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const VAR_ITEMS: CategorizedMenuItem[] = [
    { id: 'x', label: 'x', category: 'Variables' },
    { id: 'y', label: 'y', category: 'Variables' },
    { id: 'z', label: 'z', category: 'Variables' },
    { id: 't', label: 't', category: 'Time' },
];

const MODE_ITEMS: CategorizedMenuItem[] = [
    { id: 'indefinite', label: '∫ Indefinite', category: 'Integration' },
    { id: 'definite', label: '∫ₐᵇ Definite', category: 'Integration' },
];

// Explicit map: which mode produces symbolic vs scalar output
const INTEGRAL_MODE_OUTPUT: Record<string, 'symbolic' | 'scalar'> = {
    indefinite: 'symbolic', // indefinite integration → formula
    definite: 'scalar',   // definite integration → number
};

export const IntegralNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { updateNodeData } = useReactFlow();
    const varMenu = useNodeMenu();
    const modeMenu = useNodeMenu();

    const variable = (data.variable as string) || 'x';
    const mode = (data.mode as string) || 'indefinite';
    const lower = (data.lower as string) || '';
    const upper = (data.upper as string) || '';

    const handleVarSelect = useCallback((item: CategorizedMenuItem) => {
        updateNodeData(id, { variable: item.id });
        varMenu.closeMenu();
    }, [id, updateNodeData, varMenu]);

    const handleModeSelect = useCallback((item: CategorizedMenuItem) => {
        updateNodeData(id, { mode: item.id });
        modeMenu.closeMenu();
    }, [id, updateNodeData, modeMenu]);

    // Inject handles dynamically
    const handles = [
        { id: 'expr', type: 'target', position: Position.Left, variant: 'single', dataType: 'symbolic', label: 'f(x)' },
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: INTEGRAL_MODE_OUTPUT[mode] ?? 'symbolic' }
    ];

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[130px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Integral
                </div>

                <div className="w-full flex flex-col gap-1.5">
                    {/* Mode Selector */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-10 text-right pr-0.5">Mode</span>
                        <button
                            className="nodrag flex-1 bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group"
                            onClick={modeMenu.handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="truncate">{MODE_ITEMS.find(m => m.id === mode)?.label || mode}</span>
                            <svg className="w-2.5 h-2.5 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Variable Selector */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-10 text-right pr-0.5">d</span>
                        <button
                            className="nodrag flex-1 bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group"
                            onClick={varMenu.handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="font-mono">{variable}</span>
                            <svg className="w-2.5 h-2.5 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Bounds */}
                    {mode === 'definite' && (
                        <div className="flex gap-1 animate-in slide-in-from-top-1 duration-200">
                            <input
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-14 text-center focus:outline-none focus:border-zinc-500 transition-colors"
                                value={lower}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateNodeData(id, { lower: e.target.value })}
                                placeholder="a"
                            />
                            <span className="text-zinc-500 text-[10px] self-center">→</span>
                            <input
                                className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] w-14 text-center focus:outline-none focus:border-zinc-500 transition-colors"
                                value={upper}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateNodeData(id, { upper: e.target.value })}
                                placeholder="b"
                            />
                        </div>
                    )}
                </div>

                <CategorizedMenu
                    isOpen={varMenu.menuOpen}
                    items={VAR_ITEMS}
                    position={varMenu.menuPos}
                    trigger={varMenu.trigger}
                    onClose={varMenu.closeMenu}
                    onSelect={handleVarSelect}
                    placeholder="Search Var..."
                    width="24"
                />

                <CategorizedMenu
                    isOpen={modeMenu.menuOpen}
                    items={MODE_ITEMS}
                    position={modeMenu.menuPos}
                    trigger={modeMenu.trigger}
                    onClose={modeMenu.closeMenu}
                    onSelect={handleModeSelect}
                    placeholder="Select Mode..."
                    width="36"
                />
            </div>
        </BaseNode>
    );
});

IntegralNode.displayName = 'IntegralNode';
