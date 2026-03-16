
'use client';

import { memo, useCallback, useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { InputOutputEngine } from '../../engine/InputOutputEngine';
import { NodeOpSelect } from './NodeOpSelect';
import { CategorizedMenuItem } from '../ui/CategorizedMenu';

const PREDEFINED_UNIT_IDS = [
    'm', 'cm', 'mm', 'km', 'ft', 'in',
    'kg', 'g', 'lb',
    's', 'min', 'h',
    'N', 'J', 'W', 'Pa', 'V', 'A', 'C', 'degC', 'degF',
    'm/s', 'km/h', 'm/s^2', 'N*m'
];

export const UnitNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();

    // Remote states
    const remoteUnit = data.unit as string || 'm';
    const remoteCustom = data.customUnit as string || '';

    // Local UI states
    const [mode, setMode] = useState<'select' | 'custom'>(remoteUnit === 'CUSTOM' ? 'custom' : 'select');
    const [localUnit, setLocalUnit] = useState(remoteUnit === 'CUSTOM' ? remoteCustom : remoteUnit);
    const [isValid, setIsValid] = useState(true);

    // Sync local state with remote data (bidirectional sync with NPanel)
    useEffect(() => {
        if (remoteUnit === 'CUSTOM') {
            setMode('custom');
            if (remoteCustom !== localUnit) {
                setLocalUnit(remoteCustom);
                setIsValid(true);
            }
        } else if (remoteUnit && remoteUnit !== localUnit) {
            setLocalUnit(remoteUnit);
            setIsValid(true);
            setMode('select');
        }
    }, [remoteUnit, remoteCustom]);

    const validateAndApply = useCallback((unit: string, forceCustom: boolean = false) => {
        const math = InputOutputEngine.getInstance().getMathInstance();
        try {
            math.unit(unit);
            setIsValid(true);

            const updates: any = {};
            if (forceCustom || mode === 'custom') {
                updates.unit = 'CUSTOM';
                updates.customUnit = unit;
            } else {
                updates.unit = unit;
            }

            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id, data: updates }
            });
        } catch (e) {
            setIsValid(false);
        }
    }, [id, mode, brain]);

    const handleMenuSelect = (item: CategorizedMenuItem) => {
        if (item.id === 'CUSTOM') {
            setMode('custom');
            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id, data: { unit: 'CUSTOM' } }
            });
        } else {
            setLocalUnit(item.id);
            setMode('select');
            validateAndApply(item.id);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setLocalUnit(value);
        validateAndApply(value, true);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') validateAndApply(localUnit);
    };

    const toggleMode = () => {
        const newMode = mode === 'select' ? 'custom' : 'select';
        setMode(newMode);
        if (newMode === 'select') {
            // Default back to meter if switching back
            const fallback = 'm';
            setLocalUnit(fallback);
            validateAndApply(fallback);
        } else {
            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id, data: { unit: 'CUSTOM' } }
            });
        }
    };

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1">
                <div className="flex items-center justify-center">
                    {mode === 'select' && (
                        <NodeOpSelect
                            nodeId={id}
                            defId="TR-01"
                            paramId="unit"
                            data={data}
                            label=""
                            onSelect={handleMenuSelect}
                            width="48"
                        />
                    )}

                    {mode === 'custom' && (
                        <div className={`relative group flex items-center bg-zinc-900 border ${isValid ? 'border-zinc-700/50' : 'border-red-500/50'
                        } rounded-[10px] px-1 py-0.5 transition-all duration-200 min-h-[28px]`}>
                            <button
                                onClick={toggleMode}
                                className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
                                onMouseDown={(e) => e.stopPropagation()}
                                title="Back to predefined list"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 18H5V13M19 13V18H14M5 11V6H10M14 6V11H19" />
                                </svg>
                            </button>
                            <input
                                autoFocus
                                className="nodrag bg-transparent text-zinc-100 text-[11px] px-1 py-0.5 outline-none w-20 text-center font-mono placeholder:text-zinc-600"
                                value={localUnit}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="e.g. m/s"
                                onMouseDown={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                </div>
            </div>
        </BaseNode>
    );
});
UnitNode.displayName = 'UnitNode';
