/**
 * NodeOpSelect
 * 
 * Generic, definition-driven dropdown selector for on-canvas node UIs.
 * Reads options from NODE_DEFINITIONS via `useNodeParam`, eliminating all
 * per-node hard-coded option arrays.
 * 
 * Usage:
 *   <NodeOpSelect nodeId={id} defId={type} paramId="op" data={data} />
 */

'use client';

import { memo, useCallback } from 'react';
import { useBrain } from '../../context/BrainContext';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { useNodeParam } from '../../hooks/useNodeParam';
import { useHistoryStore } from '../../store/useHistoryStore';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

interface NodeOpSelectProps {
    nodeId: string;
    defId: string | undefined;
    paramId: string;
    data: Record<string, unknown>;
    label?: string;
    placeholder?: string;
    width?: string;
    /** Optional additional data to merge into the Brain transaction. */
    extraData?: (value: string) => Record<string, unknown>;
    onSelect?: (item: CategorizedMenuItem) => void;
    showSearch?: boolean;
    showCategories?: boolean;
    /** Optional dynamic options to override static ones from definitions. */
    overrideOptions?: CategorizedMenuItem[];
}

export const NodeOpSelect = memo(({
    nodeId,
    defId,
    paramId,
    data,
    label,
    placeholder,
    width = '48',
    extraData,
    onSelect,
    showSearch = false,
    showCategories = false,
    overrideOptions,
}: NodeOpSelectProps) => {
    const brain = useBrain();
    const { push } = useHistoryStore();
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const { options: staticOptions, currentValue, currentLabel: staticLabel } = useNodeParam(nodeId, defId, paramId, data);

    const options = overrideOptions || staticOptions;
    
    // Determine the label to show in the trigger button
    const currentLabel = overrideOptions 
        ? (overrideOptions.find(opt => opt.id === currentValue)?.label || String(currentValue || placeholder || 'Select...'))
        : staticLabel;

    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        const newValue = item.id;
        const previousValue = currentValue;

        if (newValue !== previousValue) {
            push({
                id: `select_${nodeId}_${paramId}_${Date.now()}`,
                description: `Change ${paramId}: ${item.label}`,
                forward: [{ type: 'UPDATE_NODE_DATA', payload: { id: nodeId, data: { [paramId]: newValue } } }],
                inverse: [{ type: 'UPDATE_NODE_DATA', payload: { id: nodeId, data: { [paramId]: previousValue } } }]
            });

            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: {
                    id: nodeId,
                    data: { [paramId]: newValue }
                }
            });
        }

        if (onSelect) {
            onSelect(item);
        }

        closeMenu();
    }, [nodeId, paramId, brain, closeMenu, onSelect]);

    return (
        <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
            {label && (
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                    {label}
                </label>
            )}
            <button
                className="nodrag w-full bg-zinc-900 border border-zinc-700/50 rounded-[10px] px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-50 transition-all flex items-center justify-between group active:scale-95"
                onClick={handleTrigger}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <span className="truncate font-medium group-hover:text-white">{currentLabel}</span>
                <svg className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <CategorizedMenu
                isOpen={menuOpen}
                items={options}
                position={menuPos}
                trigger={trigger}
                onClose={closeMenu}
                onSelect={handleSelect}
                placeholder={placeholder ?? 'Search...'}
                width={width}
                selectedId={currentValue}
                showSearch={showSearch}
                showCategories={showCategories}
            />
        </div>
    );
});

NodeOpSelect.displayName = 'NodeOpSelect';
