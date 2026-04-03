/**
 * useNodeParam
 * 
 * Reads a `select`-type NodeParameter from NODE_DEFINITIONS and returns
 * the options as CategorizedMenuItems, the current value/label, and a dispatcher.
 * 
 * This eliminates duplication where both nodeDefinitions.ts AND each node component
 * define the same set of options.
 */

import { useCallback } from 'react';
import { NODE_DEFINITIONS } from '@/types/nodeDefinitions';
import { CategorizedMenuItem } from '../components/ui/CategorizedMenu';
import { Brain } from '../engine/Brain';
import { useBrain } from '../context/BrainContext';
import { PayloadUtils } from '../utils/PayloadUtils';

export interface UseNodeParamResult {
    /** Options in CategorizedMenu format, built from the definition. */
    options: CategorizedMenuItem[];
    /** Current string value (coerced from data[paramId]). */
    currentValue: string;
    /** The display label for the current value. */
    currentLabel: string;
    /** Dispatch a transaction to update this param in the Brain. */
    dispatch: (value: string, extraData?: Record<string, unknown>) => void;
}

export function useNodeParam(
    nodeId: string,
    defId: string | undefined,
    paramId: string,
    data: Record<string, unknown>
): UseNodeParamResult {
    const brain = useBrain();
    const def = NODE_DEFINITIONS.find(d => d.id === defId);
    const param = def?.params?.find(p => p.id === paramId);

    // Convert NodeParameter options → CategorizedMenuItems (merging category + aliases)
    const options: CategorizedMenuItem[] = (param?.options ?? []).map(opt => ({
        id: String(opt.value),
        label: opt.label,
        category: opt.category || '',
        aliases: opt.aliases,
    }));

    const val = data[paramId];
    // Backward compatibility: If we're looking for 'mode' but only 'op' exists, use it.
    const rawVal = (paramId === 'mode' && val === undefined) ? data.op : val;
    const effectiveValue = PayloadUtils.unwrap(rawVal);

    const currentValue = String(effectiveValue ?? options[0]?.id ?? '');
    const currentLabel = options.find(o => o.id === currentValue)?.label ?? currentValue;

    const dispatch = useCallback(
        (value: string, extraData?: Record<string, unknown>) => {
            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: {
                    id: nodeId,
                    data: { [paramId]: value, ...extraData }
                }
            });
        },
        [nodeId, paramId, brain]
    );

    return { options, currentValue, currentLabel, dispatch };
}

