
import { memo, useCallback, useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { InputOutputEngine } from '../../engine/InputOutputEngine';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { CategorizedMenu, CategorizedMenuItem } from '../ui/CategorizedMenu';

const UNIT_ITEMS: CategorizedMenuItem[] = [
    // Length
    { id: 'm', label: 'Meter (m)', category: 'Length' },
    { id: 'cm', label: 'Centimeter (cm)', category: 'Length' },
    { id: 'mm', label: 'Millimeter (mm)', category: 'Length' },
    { id: 'km', label: 'Kilometer (km)', category: 'Length' },
    { id: 'ft', label: 'Feet (ft)', category: 'Length' },
    { id: 'in', label: 'Inch (in)', category: 'Length' },
    // Mass
    { id: 'kg', label: 'Kilogram (kg)', category: 'Mass' },
    { id: 'g', label: 'Gram (g)', category: 'Mass' },
    { id: 'lb', label: 'Pound (lb)', category: 'Mass' },
    // Time
    { id: 's', label: 'Second (s)', category: 'Time' },
    { id: 'min', label: 'Minute (min)', category: 'Time' },
    { id: 'h', label: 'Hour (h)', category: 'Time' },
    // Physics
    { id: 'N', label: 'Newton (N)', category: 'Physics' },
    { id: 'J', label: 'Joule (J)', category: 'Physics' },
    { id: 'W', label: 'Watt (W)', category: 'Physics' },
    { id: 'Pa', label: 'Pascal (Pa)', category: 'Physics' },
    { id: 'V', label: 'Volt (V)', category: 'Physics' },
    { id: 'A', label: 'Ampere (A)', category: 'Physics' },
    { id: 'C', label: 'Coulomb (C)', category: 'Physics' },
    { id: 'degC', label: 'Celsius (°C)', category: 'Physics' },
    { id: 'degF', label: 'Fahrenheit (°F)', category: 'Physics' },
    // Compound
    { id: 'm/s', label: 'm/s', category: 'Compound' },
    { id: 'km/h', label: 'km/h', category: 'Compound' },
    { id: 'm/s^2', label: 'm/s²', category: 'Compound' },
    { id: 'N*m', label: 'N·m', category: 'Compound' },
    // Special
    { id: 'CUSTOM_ENTRY', label: 'Custom Unit...', category: 'Special', icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> }
];

const PREDEFINED_UNIT_IDS = UNIT_ITEMS.map(u => u.id);

export const UnitNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const { menuOpen, menuPos, trigger, handleTrigger, closeMenu } = useNodeMenu();

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

            Brain.getInstance().applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id, data: updates }
            });
        } catch (e) {
            setIsValid(false);
        }
    }, [id, mode]);

    const handleMenuSelect = (item: CategorizedMenuItem) => {
        if (item.id === 'CUSTOM_ENTRY') {
            setMode('custom');
            Brain.getInstance().applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id, data: { unit: 'CUSTOM' } }
            });
        } else {
            setLocalUnit(item.id);
            setMode('select');
            validateAndApply(item.id);
        }
        closeMenu();
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
            Brain.getInstance().applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id, data: { unit: 'CUSTOM' } }
            });
        }
    };

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1">
                <div className="flex items-center justify-center">
                    <div className={`relative group flex items-center bg-zinc-900 border ${isValid ? 'border-zinc-700/50' : 'border-red-500/50'
                        } rounded-md px-1 py-0.5 transition-all duration-200 min-h-[28px]`}>

                        {mode === 'select' ? (
                            <div className="flex items-center">
                                <button
                                    className="nodrag bg-transparent text-zinc-100 text-[11px] px-1.5 py-0.5 outline-none min-w-[70px] flex items-center justify-between group/btn"
                                    onClick={handleTrigger}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <span className="truncate group-hover/btn:text-blue-400 transition-colors uppercase font-bold">{localUnit}</span>
                                    <div className="text-zinc-600 ml-1 group-hover/btn:text-zinc-400 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center">
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

                        {!isValid ? (
                            <div className="absolute -top-3.5 left-0 right-0 text-[8px] text-red-500 text-center font-bold animate-pulse uppercase">
                                Invalid
                            </div>
                        ) : mode === 'custom' && (
                            <div className="absolute -top-3.5 left-0 right-0 text-[8px] text-blue-400/60 text-center font-bold uppercase">
                                Manual Entry
                            </div>
                        )}
                    </div>
                </div>

                <CategorizedMenu
                    isOpen={menuOpen}
                    items={UNIT_ITEMS}
                    position={menuPos}
                    trigger={trigger}
                    onClose={closeMenu}
                    onSelect={handleMenuSelect}
                    placeholder="Search Units..."
                    width="48"
                />
            </div>
        </BaseNode>
    );
});
UnitNode.displayName = 'UnitNode';
