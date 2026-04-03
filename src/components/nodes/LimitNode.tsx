import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const VAR_ITEMS: CategorizedMenuItem[] = [
    { id: 'x', label: 'x', category: 'Variables' },
    { id: 'y', label: 'y', category: 'Variables' },
    { id: 'z', label: 'z', category: 'Variables' },
    { id: 't', label: 't', category: 'Time' },
    { id: 'n', label: 'n', category: 'Series' },
];

const SIDE_ITEMS: CategorizedMenuItem[] = [
    { id: 'both', label: 'Both (±)', category: 'Direction' },
    { id: 'left', label: 'Left (⁻)', category: 'Direction' },
    { id: 'right', label: 'Right (⁺)', category: 'Direction' },
];

export const LimitNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const varMenu = useNodeMenu();
    const sideMenu = useNodeMenu();
    const { updateNodeData } = useReactFlow();

    const variable = (data.variable as string) || 'x';
    const approach = (data.approach as string) || '0';
    const direction = (data.direction as string) || 'both';

    const handleVarSelect = useCallback((item: CategorizedMenuItem) => {
        updateNodeData(id, { variable: item.id });
        varMenu.closeMenu();
    }, [id, updateNodeData, varMenu]);

    const handleSideSelect = useCallback((item: CategorizedMenuItem) => {
        updateNodeData(id, { direction: item.id });
        sideMenu.closeMenu();
    }, [id, updateNodeData, sideMenu]);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[120px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Limit
                </div>

                <div className="w-full flex flex-col gap-1.5">
                    {/* Variable Selector */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8 text-right pr-0.5">Var</span>
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

                    {/* Approach Value */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8 text-right pr-0.5">→</span>
                        <input
                            className="nodrag bg-zinc-900 border border-zinc-700 text-zinc-300 px-1 py-1 rounded text-[10px] flex-1 text-center focus:outline-none focus:border-zinc-500 transition-colors"
                            value={approach}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateNodeData(id, { approach: e.target.value })}
                            placeholder="0"
                        />
                    </div>

                    {/* Direction Selector */}
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider w-8 text-right pr-0.5">Side</span>
                        <button
                            className="nodrag flex-1 bg-zinc-900 border border-zinc-700/50 rounded px-1.5 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group"
                            onClick={sideMenu.handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="truncate">{SIDE_ITEMS.find(s => s.id === direction)?.label || direction}</span>
                            <svg className="w-2.5 h-2.5 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
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
                    isOpen={sideMenu.menuOpen}
                    items={SIDE_ITEMS}
                    position={sideMenu.menuPos}
                    trigger={sideMenu.trigger}
                    onClose={sideMenu.closeMenu}
                    onSelect={handleSideSelect}
                    placeholder="Select Side..."
                    width="32"
                />
            </div>
        </BaseNode>
    );
});

LimitNode.displayName = 'LimitNode';

