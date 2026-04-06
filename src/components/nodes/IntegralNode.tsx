import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow, Position } from '@xyflow/react';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';
import { StringInput } from '../common/StringInput';

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
    const lower = (data.lower ?? '') as any;
    const upper = (data.upper ?? '') as any;

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
        { id: 'in_a', type: 'target', position: Position.Left, variant: 'single', dataType: 'symbolic' as any, label: 'f(x)' },
        { id: 'in_b', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' as any, label: 'a' },
        { id: 'in_c', type: 'target', position: Position.Left, variant: 'single', dataType: 'scalar' as any, label: 'b' },
        { id: 'out_a', type: 'source', position: Position.Right, variant: 'single', dataType: (INTEGRAL_MODE_OUTPUT[mode] ?? 'symbolic') as any }
    ];

    const nodeData = { ...data, handles };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[140px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Integral
                </div>

                <div className="w-full flex flex-col gap-2">
                    {/* Mode Selector */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Mode</span>
                        <button
                            className="nodrag w-full bg-zinc-900 border border-zinc-700/50 rounded-md px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group h-6"
                            onClick={modeMenu.handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="truncate">{MODE_ITEMS.find(m => m.id === mode)?.label || mode}</span>
                            <svg className="w-2 h-2 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Variable Selector */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Variable</span>
                        <button
                            className="nodrag w-full bg-zinc-900 border border-zinc-700/50 rounded-md px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group h-6"
                            onClick={varMenu.handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="font-mono">{variable}</span>
                            <svg className="w-2 h-2 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Bounds */}
                    {mode === 'definite' && (
                        <div className="flex flex-col gap-1 animate-in slide-in-from-top-1 duration-200">
                            <div className="grid grid-cols-2 gap-1 px-0.5 text-[8px] text-zinc-600 uppercase font-bold tracking-widest text-center">
                                <span>Lower</span>
                                <span>Upper</span>
                            </div>
                            <div className="flex gap-1 items-center">
                                <StringInput
                                    value={lower}
                                    onChange={(val) => updateNodeData(id, { lower: val })}
                                    variant="standard"
                                    monospace={true}
                                    hideLabel={true}
                                    inputClassName="text-center h-6 px-1 text-[10px] flex-1 min-w-0"
                                    placeholder="a"
                                />
                                <span className="text-zinc-700 text-[8px]">→</span>
                                <StringInput
                                    value={upper}
                                    onChange={(val) => updateNodeData(id, { upper: val })}
                                    variant="standard"
                                    monospace={true}
                                    hideLabel={true}
                                    inputClassName="text-center h-6 px-1 text-[10px] flex-1 min-w-0"
                                    placeholder="b"
                                />
                            </div>
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

