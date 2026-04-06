import { memo, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';
import { StringInput } from '../common/StringInput';

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
            <div className="flex flex-col gap-2 p-2 relative items-center justify-center min-w-[140px]">
                <div className="text-[11px] font-bold text-zinc-300 tracking-widest uppercase mb-1">
                    Limit
                </div>

                <div className="w-full flex flex-col gap-2">
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

                    {/* Approach Value */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">To (→)</span>
                        <StringInput
                            value={approach}
                            onChange={(val) => updateNodeData(id, { approach: val })}
                            variant="standard"
                            monospace={true}
                            hideLabel={true}
                            inputClassName="h-6 text-[10px] px-1 text-center"
                            className="w-full"
                            placeholder="0"
                        />
                    </div>

                    {/* Direction Selector */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Side</span>
                        <button
                            className="nodrag w-full bg-zinc-900 border border-zinc-700/50 rounded-md px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group h-6"
                            onClick={sideMenu.handleTrigger}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <span className="truncate">{SIDE_ITEMS.find(s => s.id === direction)?.label || direction}</span>
                            <svg className="w-2 h-2 text-zinc-600 group-hover:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

