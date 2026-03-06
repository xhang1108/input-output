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

import { memo, useCallback } from 'react';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { useNodeParam } from '../../hooks/useNodeParam';
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
}: NodeOpSelectProps) => {
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();
    const { options, currentLabel, dispatch } = useNodeParam(nodeId, defId, paramId, data);

    const handleSelect = useCallback((item: CategorizedMenuItem) => {
        dispatch(item.id, extraData?.(item.id));
        closeMenu();
    }, [dispatch, closeMenu, extraData]);

    return (
        <div className="flex flex-col gap-1.5 p-1 min-w-[120px]">
            {label && (
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                    {label}
                </label>
            )}
            <button
                className="nodrag w-full bg-zinc-900/50 border border-zinc-700/50 rounded-(--radius-sm) px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all flex items-center justify-between group shadow-sm active:scale-95"
                onClick={handleTrigger}
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
            />
        </div>
    );
});

NodeOpSelect.displayName = 'NodeOpSelect';
